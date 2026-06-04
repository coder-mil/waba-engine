import { pool, getUserSession, upsertUserSession, saveMessageLog, getActiveFlow } from './db';
import { createFSM, ChatContext, States } from './fsm';
import { classifyIntent } from './nlu';

const TTL_MS = 30 * 60 * 1000; // 30 min

/**
 * Carrega o flow ativo e encontra o answer de uma intent pela definition.
 * O answer vem DO BANCO (definition.intents), não do NLU — o NLU só classifica.
 * Se a intent não for encontrada ou tiver answer vazio, retorna o anything_else do flow.
 */
async function getAnswerFromFlow(intent: string): Promise<string | undefined> {
  try {
    const flow = await getActiveFlow();
    if (!flow?.definition) return undefined;

    const definition = flow.definition as any;
    const intents = definition.intents as Array<{ name: string; answer?: string }>;

    const found = intents.find(
      (i) => i.name.toLowerCase() === intent.toLowerCase()
    );

    // Answer existe e não é vazio → usa o answer da intent
    if (found?.answer && found.answer.trim() !== '') {
      return found.answer as string;
    }

    // Fallback: anything_else é obrigatório no flow — usado quando:
    // - intent não encontrada
    // - intent encontrada mas answer é vazio
    const anythingElse = definition.anything_else;
    if (anythingElse) return anythingElse as string;

    return undefined;
  } catch {
    return undefined;
  }
}

export async function processMessage(from: string, text: string) {
  // Get session from DB or create new FSM
  let session = await getUserSession(from);

  let ctx: ChatContext;
  if (session && session.current_state && session.context_data) {
    // Resume from DB state
    const iterator = createFSM(session.current_state as any);
    ctx = {
      currentState: session.current_state,
      iterator,
      data: (typeof session.context_data === 'string') ? JSON.parse(session.context_data) : session.context_data,
    };
  } else {
    ctx = { currentState: States.INIT, iterator: createFSM(), data: {} };
  }

  // Check TTL
  if (ctx.data.lastActivity && Date.now() - ctx.data.lastActivity > TTL_MS) {
    ctx = { currentState: States.INIT, iterator: createFSM(), data: {} };
  }

  // Classify intent via NLU (classificação, não resposta)
  const classification = await classifyIntent(text);
  console.log(`Intent: ${classification.intent} (${classification.score.toFixed(2)})`);

  // Get answer from FLOW (banco de dados), não do NLU
  const flowAnswer = await getAnswerFromFlow(classification.intent);

  // Save inbound log
  await saveMessageLog({
    from,
    body: text,
    direction: 'inbound',
    intent: classification.intent,
    state: ctx.currentState,
    score: classification.score,
  });

  // Build input for FSM — answer vem do FLOW (banco), não do NLU
  const fsmInput = {
    intent: classification.intent,
    text: text,
    score: classification.score,
    answer: flowAnswer,
  };

  // FSM next
  // If currentState is INIT, it returns empty text and transitions to AWAITING_INTENT.
  // We then call next() again with the actual input so AWAITING_INTENT gives the real response.
  let result = ctx.iterator.next(fsmInput);
  if (ctx.currentState === States.INIT && result.value?.next === States.AWAITING_INTENT) {
    ctx.currentState = result.value.next; // advance to AWAITING_INTENT before second next()
    result = ctx.iterator.next(fsmInput);
  }

  // After INIT bootstrap, result.text may be empty — use flow answer as greeting fallback
  let responseText = result.value?.text;
  if (!responseText && flowAnswer) {
    responseText = flowAnswer;
    result = { ...result, value: { ...result.value, text: responseText } };
  }

  const newState = result.value?.next || ctx.currentState;
  ctx.data.lastActivity = Date.now();

  // Persist session (flowId is undefined since we use FSM directly, not from DB)
  await upsertUserSession(from, {
    currentState: newState,
    contextData: ctx.data,
  });

  // If END, clean up session
  if (result.done) {
    await pool.query('DELETE FROM user_sessions WHERE phone = $1', [from]);
  }

  // Save outbound log
  if (result.value?.action === 'send' && result.value.text) {
    await saveMessageLog({
      from,
      body: result.value.text,
      direction: 'outbound',
    });
  }

  return result.value; // { action: 'send'|'end', text: string }
}