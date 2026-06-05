const ACCESS_TOKEN = process.env.ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID!;

const fetch = require('node-fetch');

/**
 * Envia mensagem via WhatsApp Business API.
 * Logs completos de request/response para debug de erros.
 */
export async function sendReply(to: string, message: string): Promise<any> {
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  };

  console.log(`[WhatsApp API] → Enviando para ${to}: "${message}"`);

  let resp: any;
  let data: any;

  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    data = await resp.json().catch(() => ({}));

    // Log da resposta completa
    if (!resp.ok) {
      console.error(`[WhatsApp API] ❌ Erro HTTP ${resp.status}`);
      console.error(`[WhatsApp API] Body:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[WhatsApp API] ✅ Enviado para ${to}`);
      if (data.messages?.[0]?.id) {
        console.log(`[WhatsApp API] Message ID: ${data.messages[0].id}`);
      }
    }

    return data;
  } catch (err: any) {
    console.error(`[WhatsApp API] ❌ Exceção na requisição:`);
    console.error(`[WhatsApp API] Erro: ${err.message}`);
    console.error(`[WhatsApp API] URL: ${url}`);
    console.error(`[WhatsApp API] To: ${to}, Message: "${message}"`);
    throw err;
  }
}