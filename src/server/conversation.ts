import { pool, getUserSession, upsertUserSession, saveMessageLog } from './db';
import { createFSM, ChatContext, States } from './fsm';
import { classifyIntent } from './nlu';

const TTL_MS = 30 * 60 * 1000; // 30 min

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

  // Classify intent
  const classification = await classifyIntent(text);
  console.log(`Intent: ${classification.intent} (${classification.score.toFixed(2)})`);

  // Save inbound log
  await saveMessageLog({
    from,
    body: text,
    direction: 'inbound',
    intent: classification.intent,
    state: ctx.currentState,
    score: classification.score,
  });

  // Build input for FSM
  const fsmInput = {
    intent: classification.intent,
    text: text,
    score: classification.score,
    answer: classification.answer,
  };

  // FSM next
  const result = ctx.iterator.next(fsmInput);
  const newState = result.value?.next || ctx.currentState;
  ctx.data.lastActivity = Date.now();

  // Persist session
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