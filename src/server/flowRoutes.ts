import * as express from 'express';
import { pool, getActiveFlow } from './db';
import { classifyIntent } from './nlu';

const router = express.Router();

// ─── Flows CRUD ──────────────────────────────────────────────────────────────

// GET /api/flows → listar todos
router.get('/flows', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, is_active, created_at, updated_at FROM flows ORDER BY created_at DESC'
    );
    res.json({ flows: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flows/:id → detalhar um flow
router.get('/flows/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM flows WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Flow não encontrado' });
    res.json({ flow: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows → criar flow
router.post('/flows', async (req, res) => {
  const { name, description = '', definition = {}, states = [], edges = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });

  try {
    const result = await pool.query(
      `INSERT INTO flows (name, description, definition, states, edges)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description, JSON.stringify(definition), JSON.stringify(states), JSON.stringify(edges)]
    );
    res.status(201).json({ flow: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/flows/:id → editar flow
router.put('/flows/:id', async (req, res) => {
  const { name, description, definition, states, edges, is_active } = req.body;
  try {
    const current = await pool.query('SELECT * FROM flows WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Flow não encontrado' });

    const result = await pool.query(
      `UPDATE flows SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        definition = COALESCE($3, definition),
        states = COALESCE($4, states),
        edges = COALESCE($5, edges),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, description, definition ? JSON.stringify(definition) : null,
       states ? JSON.stringify(states) : null, edges ? JSON.stringify(edges) : null, req.params.id]
    );
    res.json({ flow: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/flows/:id → remover flow
router.delete('/flows/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM flows WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Flow não encontrado' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows/:id/activate → ativar flow (desativa todos os outros)
router.post('/flows/:id/activate', async (req, res) => {
  try {
    await pool.query('UPDATE flows SET is_active = false'); // desativa todos
    const result = await pool.query(
      'UPDATE flows SET is_active = true, activated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Flow não encontrado' });
    res.json({ flow: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flows/active → flow ativo
router.get('/flows/active', async (req, res) => {
  try {
    const flow = await getActiveFlow();
    res.json({ flow });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NLU Training ────────────────────────────────────────────────────────────

// POST /api/nlu/train → re-treinar NLU com phrases do flow ativo
router.post('/nlu/train', async (req, res) => {
  try {
    const flow = await getActiveFlow();
    if (!flow) return res.status(400).json({ error: 'Nenhum flow ativo' });

    const { definition } = flow;
    if (!definition || !definition.intents) {
      return res.status(400).json({ error: 'Flow não tem intents definidos em definition.intents' });
    }

    // Import dinâmico do nlu para poder re-treinar
    const { trainFromFlow } = await import('./nlu');
    await trainFromFlow(definition);

    res.json({ success: true, message: 'NLU treinado com sucesso', intents: definition.intents.length });
  } catch (err: any) {
    console.error('Erro no train:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nlu/test → testar classificação
router.get('/nlu/test', async (req, res) => {
  const { q, lang = 'pt' } = req.query;
  if (!q) return res.status(400).json({ error: 'query param "q" obrigatório' });

  try {
    const result = await classifyIntent(q as string, lang as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Message Logs ───────────────────────────────────────────────────────────

// GET /api/logs → logs de mensagem (com paginação)
router.get('/logs', async (req, res) => {
  const { limit = 50, offset = 0, from } = req.query;
  try {
    let query = 'SELECT * FROM message_logs';
    const params: any[] = [];

    if (from) {
      query += ' WHERE from_number = $1';
      params.push(from);
      query += ' ORDER BY timestamp DESC LIMIT $2 OFFSET $3';
      params.push(limit, offset);
    } else {
      query += ' ORDER BY timestamp DESC LIMIT $1 OFFSET $2';
      params.push(limit, offset);
    }

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM message_logs');

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs/sessions → sessões ativas
router.get('/logs/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_sessions ORDER BY last_activity DESC LIMIT 100'
    );
    res.json({ sessions: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;