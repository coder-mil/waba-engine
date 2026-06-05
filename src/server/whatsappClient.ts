const ACCESS_TOKEN = process.env.ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID!;

const fetch = require('node-fetch');

/**
 * Envia mensagem via WhatsApp Business API.
 * Logs completos de request/response para debug de erros.
 */
/**
 * Envia mensagem via WhatsApp Business API.
 * Logs completos de request/response para debug de erros.
 * Support Quick Reply Buttons quando passed.
 */
export async function sendReply(
  to: string,
  message: string,
  buttons?: Array<{ label: string; value: string }>
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

  let body: any = {
    messaging_product: 'whatsapp',
    to,
  };

  if (buttons && buttons.length > 0) {
    body.type = 'interactive';
    body.interactive = {
      type: 'button',
      body: { text: message },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: { title: btn.label, id: btn.value },
        })),
      },
    };
  } else {
    body.type = 'text';
    body.text = { body: message };
  }

  console.log(`[WhatsApp API] → Enviando para ${to}: "${message}"${buttons?.length ? ` [${buttons.length} buttons]` : ''}`);

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
    throw err;
  }
}