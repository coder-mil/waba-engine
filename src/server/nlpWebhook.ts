import * as express from 'express';
import { getNlpFlowByPath } from './db';
import { matchAnswer } from './nlpEngine';
import { sendReply } from './whatsappClient';

const router = express.Router();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN!;

// GET /:flowPath/webhook → Meta verifica se o endpoint existe
router.get('/:flowPath/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const flowPath = req.params.flowPath;

  const flow = await getNlpFlowByPath(flowPath);
  if (!flow) return res.status(404).send('Flow não encontrado');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log(`✅ NLP Webhook verified for flow: ${flowPath}`);
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /:flowPath/webhook → receber mensagens do WhatsApp
router.post('/:flowPath/webhook', async (req, res) => {
  res.status(200).send('OK');

  const flowPath = req.params.flowPath;
  const body = req.body;

  if (body.object !== 'whatsapp_business_account') return;

  const flow = await getNlpFlowByPath(flowPath);
  if (!flow) {
    console.error(`[NLP Webhook] Flow não encontrado: ${flowPath}`);
    return;
  }

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      const messages = change.value?.messages;
      if (!messages || !Array.isArray(messages) || !messages.length) continue;
      const msg = messages[0];
      if (!msg) continue;

      const from = msg.from;
      const text = msg.text?.body || '';
      if (!text) continue;

      console.log(`📩 [${flowPath}] ${from}: ${text}`);

      try {
        const result = await matchAnswer(flow.id, text);
        console.log(`[NLP] matchedBy=${result.matchedBy} score=${result.score.toFixed(2)} → "${result.answer?.answer}"`);

        if (result.answer) {
          await sendReply(from, result.answer.answer, result.answer.buttons);
          console.log(`📤 [${flowPath}] → ${from}: ${result.answer.answer}${result.answer.buttons.length ? ` [${result.answer.buttons.length} buttons]` : ''}`);
        }
      } catch (err) {
        console.error(`[NLP Webhook] Erro ao processar mensagem:`, err);
      }
    }
  }
});

export default router;
