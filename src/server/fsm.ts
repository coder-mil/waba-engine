import { Node, Edge, FsmInput, FsmOutput, FlowDefinition, SessionContext } from './types/flow';
import { renderTemplate } from './template';

/**
 * Score abaixo do qual classificamos a mensagem como "nenhuma intenção reconhecida".
 * Exposto como constante para que NLU / flow editor / testes possam referenciar o
 * mesmo limite sem hardcode espalhado.
 */
export const SCORE_THRESHOLD = 0.5;

/**
 * Função PURA de transição do FSM.
 *
 * Dado o nó atual, o input do usuário (intent + entities + score) e o contexto da
 * sessão, devolve a próxima resposta do bot e o id do próximo nó.
 *
 * Regras:
 *  1. Edges são avaliadas top-down; a primeira que casa vence.
 *  2. Condições suportadas: `intent:X`, `intent:none`, `entity:X`, `context:KEY present|empty`.
 *  3. Se nenhum edge casou, fica no próprio nó (loop educado) e re-renderiza
 *     a `answer` daquele nó.
 *  4. `edge.set` é aplicado ANTES de renderizar a answer do nó destino, para que
 *     o template do destino possa usar `{{contexto.X}}` recém-setado.
 *  5. Se o nó destino é `terminal: true`, marca `isTerminal = true`.
 *
 * @param currentNode  Nó onde a conversa está agora.
 * @param input        Output do NLU + extrator de entidades.
 * @param flow         Definição completa do flow (usado para resolver o nó destino pelo id).
 * @param context      Contexto da sessão — mutado in-place quando um edge define `set`.
 * @returns            Próximo estado + texto a enviar + flag de terminalidade.
 */
export function transition(
  currentNode: Node,
  input: FsmInput,
  flow: FlowDefinition,
  context: SessionContext
): FsmOutput {
  const matchedEdge = currentNode.edges.find(edge => matchEdge(edge, input, context));

  let nextNode: Node;

  if (matchedEdge) {
    if (matchedEdge.set) {
      applySet(matchedEdge.set, input, context);
    }
    const found = flow.nodes.find(n => n.id === matchedEdge.to);
    // Edge aponta pra um nó inexistente? Mantém no próprio nó pra evitar crash.
    nextNode = found ?? currentNode;
  } else {
    // Nenhum edge casou — "loop educado": reenvia a própria mensagem do nó.
    nextNode = currentNode;
  }

  // Se o destino não tem answer (ex.: nó de "goto puro"), emite string vazia.
  const text = renderTemplate(nextNode.answer ?? '', context, firstEntity(input));

  return {
    nextNodeId: nextNode.id,
    text,
    isTerminal: !!nextNode.terminal,
  };
}

/**
 * Avalia a condição de um edge contra o input e contexto atuais.
 * Retorna `true` se o edge casa.
 */
function matchEdge(edge: Edge, input: FsmInput, context: SessionContext): boolean {
  const when = edge.when;

  if (when.startsWith('intent:')) {
    const name = when.slice('intent:'.length);
    if (name === 'none') {
      // "intent:none" → NLU não classificou com confiança
      return input.score < SCORE_THRESHOLD;
    }
    return input.intent === name;
  }

  if (when.startsWith('entity:')) {
    const name = when.slice('entity:'.length);
    return typeof input.entities[name] === 'string';
  }

  if (when.startsWith('context:')) {
    // formato: "context:KEY present|empty"
    const rest = when.slice('context:'.length);
    const [key, op] = rest.split(' ');
    if (op === 'present') return !!context[key];
    if (op === 'empty') return !context[key];
    return false;
  }

  return false;
}

/**
 * Aplica as definições de `edge.set` no contexto da sessão.
 * O valor especial `{{entity}}` é substituído pela primeira entity string
 * encontrada no input (consistente com `renderTemplate`).
 */
function applySet(
  set: Record<string, string>,
  input: FsmInput,
  context: SessionContext
): void {
  for (const [k, v] of Object.entries(set)) {
    if (v === '{{entity}}') {
      const e = firstEntity(input);
      context[k] = e ?? '';
    } else {
      context[k] = v;
    }
  }
}

/**
 * Retorna o primeiro valor de entity que seja string não-nula, ou null.
 * Usado tanto por `applySet` quanto por `renderTemplate` (passado como currentEntity).
 */
function firstEntity(input: FsmInput): string | null {
  for (const v of Object.values(input.entities)) {
    if (typeof v === 'string') return v;
  }
  return null;
}
