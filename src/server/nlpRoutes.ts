import * as express from 'express';
import {
  getAllNlpFlows,
  getNlpFlowById,
  createNlpFlow,
  updateNlpFlow,
  deleteNlpFlow,
  activateNlpFlow,
  getNlpAnswersByFlow,
  createNlpAnswer,
  updateNlpAnswer,
  deleteNlpAnswer,
} from './db';
import { matchAnswer } from './nlpEngine';

const router = express.Router();

// ─── Flows CRUD ──────────────────────────────────────────────────────────────

router.get('/flows', async (req, res) => {
  try {
    const flows = await getAllNlpFlows();
    res.json({ flows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/flows', async (req, res) => {
  const { name, path, description, defaultAnswer } = req.body;
  if (!name || !path) return res.status(400).json({ error: 'name e path são obrigatórios' });

  try {
    const flow = await createNlpFlow({ name, path, description, defaultAnswer });
    res.status(201).json({ flow });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Path já existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/flows/:id', async (req, res) => {
  try {
    const existing = await getNlpFlowById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Flow não encontrado' });

    const { name, path, description, defaultAnswer } = req.body;
    const flow = await updateNlpFlow(Number(req.params.id), { name, path, description, defaultAnswer });
    res.json({ flow });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Path já existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/flows/:id', async (req, res) => {
  try {
    const existing = await getNlpFlowById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Flow não encontrado' });
    await deleteNlpFlow(Number(req.params.id));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/flows/:id/activate', async (req, res) => {
  try {
    const existing = await getNlpFlowById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Flow não encontrado' });
    const flow = await activateNlpFlow(Number(req.params.id));
    res.json({ flow });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Answers CRUD ────────────────────────────────────────────────────────────

router.get('/flows/:id/answers', async (req, res) => {
  try {
    const answers = await getNlpAnswersByFlow(Number(req.params.id));
    res.json({ answers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/flows/:id/answers', async (req, res) => {
  const { question, keywords, answer, buttons } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question e answer são obrigatórios' });

  try {
    const flow = await getNlpFlowById(Number(req.params.id));
    if (!flow) return res.status(404).json({ error: 'Flow não encontrado' });

    const answerRow = await createNlpAnswer({
      flowId: Number(req.params.id),
      question,
      keywords: keywords || [],
      answer,
      buttons: buttons || [],
    });
    res.status(201).json({ answer: answerRow });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/answers/:id', async (req, res) => {
  try {
    const { question, keywords, answer, buttons, isActive } = req.body;
    const updated = await updateNlpAnswer(Number(req.params.id), { question, keywords, answer, buttons, isActive });
    if (!updated) return res.status(404).json({ error: 'Resposta não encontrada' });
    res.json({ answer: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/answers/:id', async (req, res) => {
  try {
    await deleteNlpAnswer(Number(req.params.id));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Test ───────────────────────────────────────────────────────────────────

router.get('/flows/:id/test', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'query param "q" obrigatório' });

  try {
    const result = await matchAnswer(Number(req.params.id), q as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
