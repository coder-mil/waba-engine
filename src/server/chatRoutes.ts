import * as express from 'express';
import { processMessage } from './conversation';
import { pool } from './db';

const router = express.Router();

// Web chat phone prefix
const WEB_PHONE = 'web-chat-001';

// POST /api/chat → processar mensagem do chat web
router.post('/api/chat', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  try {
    const result = await processMessage(WEB_PHONE, text.trim());
    res.json({ 
      success: true, 
      response: result?.text || null,
      action: result?.action || null,
    });
  } catch (err: any) {
    console.error('Erro no chat:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/messages → buscar histórico do chat web
router.get('/api/chat/messages', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT direction, body, intent, score, created_at 
       FROM message_logs 
       WHERE from_phone = $1 
       ORDER BY created_at ASC 
       LIMIT 50`,
      [WEB_PHONE]
    );
    res.json({ messages: result.rows });
  } catch (err: any) {
    console.error('Erro ao buscar mensagens:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chat/reset → resetar sessão do chat web
router.delete('/api/chat/reset', async (req, res) => {
  try {
    await pool.query('DELETE FROM user_sessions WHERE phone = $1', [WEB_PHONE]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
