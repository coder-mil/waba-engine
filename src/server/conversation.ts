import { pool, getUserSession, upsertUserSession, saveMessageLog, getActiveFlow } from './db';
import { transition, SCORE_THRESHOLD } from './fsm';
import { classifyIntent } from './nlu';
import { extractEntities } from './entities';
import type { FlowDefinition, Node, FsmInput, SessionContext } from './types/flow';

const DEFAULT_TTL_MIN = 30;

export async function processMessage(from: string, text: string) {
  const flow = await getActiveFlow();
  if (!flow) {
    return { action: 'send', text: 'Nenhum flow ativo no momento.' };
  }
  const definition = flow.definition as unknown as FlowDefinition;
  const ttlMin = definition.ttl_minutes ?? DEFAULT_TTL_MIN;
  const ttlMs = ttlMin * 60 * 1000;

  // Load or create session
  let session = await getUserSession(from);
  let currentNodeId: string;
  let context: SessionContext;

  if (session && session.current_state && session.context_data) {
    const lastActivity = new Date(session.last_activity).getTime();
    if (Date.now() - lastActivity > ttlMs) {
      // Expired
      currentNodeId = definition.initial_hint ?? definition.nodes[0]?.id ?? '';
      context = {};
    } else {
      currentNodeId = session.current_state;
      const raw = session.context_data;
      context = (typeof raw === 'string') ? JSON.parse(raw) : (raw as SessionContext);
    }
  } else {
    currentNodeId = definition.initial_hint ?? definition.nodes[0]?.id ?? '';
    context = {};
  }

  const currentNode = definition.nodes.find(n => n.id === currentNodeId);
  if (!currentNode) {
    return { action: 'send', text: 'Estado inicial inválido no flow.' };
  }

  // NLU classification
  const classification = await classifyIntent(text);
  console.log(`[processMessage] from=${from} state=${currentNodeId} intent=${classification.intent} (${classification.score.toFixed(2)})`);

  // Extract entities referenced by current node's edges
  const requiredEntityNames = collectEntityNames(currentNode);
  const entities = extractEntities(text, definition.entities ?? [], requiredEntityNames);

  // FSM transition
  const fsmInput: FsmInput = {
    text,
    intent: classification.intent,
    score: classification.score,
    entities,
  };
  const output = transition(currentNode, fsmInput, definition, context);

  // Save inbound log
  await saveMessageLog({
    from,
    body: text,
    direction: 'inbound',
    intent: classification.intent,
    state: currentNodeId,
    score: classification.score,
  });

  // Persist session
  await upsertUserSession(from, {
    flowId: flow.id,
    currentState: output.nextNodeId,
    contextData: context,
  });

  // Save outbound log
  if (output.text) {
    await saveMessageLog({
      from,
      body: output.text,
      direction: 'outbound',
      state: output.nextNodeId,
    });
  }

  return { action: output.isTerminal ? 'end' : 'send', text: output.text };
}

function collectEntityNames(node: Node): string[] {
  const names = new Set<string>();
  for (const edge of node.edges) {
    if (edge.when.startsWith('entity:')) {
      names.add(edge.when.slice(7));
    }
  }
  return Array.from(names);
}
