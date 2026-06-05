import * as express from 'express';
import { processMessage } from './conversation';
import { sendReply } from './whatsappClient';

const router = express.Router();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID!;

// GET /webhook → Meta verifica se o endpoint existe
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /webhook → receber mensagens
router.post('/webhook', async (req, res) => {
  // Responder imediatamente (< 5s é obrigatório)
  res.status(200).send('OK');

  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return;

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

      console.log(`📩 ${from}: ${text}`);

      // Process through FSM + NLU
      try {
        const result = await processMessage(from, text);
        if (result?.action === 'send' && result.text) {
          await sendReply(from, result.text);
          console.log(`📤 → ${from}: ${result.text}`);
        }
      } catch (err) {
        console.error('Erro ao processar mensagem:', err);
      }
    }
  }
});

// GET /webhook/info → debug
router.get('/webhook/info', (req, res) => {
  res.json({
    configured: !!(VERIFY_TOKEN && ACCESS_TOKEN && PHONE_NUMBER_ID),
    phoneNumberId: PHONE_NUMBER_ID ? `${PHONE_NUMBER_ID.slice(0, 4)}...` : 'not set',
  });
});

export default router;