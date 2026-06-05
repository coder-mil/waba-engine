// Tipos canônicos do FlowDefinition v3
// Diagrama de estados: nodes[] + edges[] decidem resposta e transição

export type Intent = {
  name: string;        // ex: "agendar", "saudacao"
  phrases: string[];   // sentenças naturais completas para treinar o NLU
};

export type Entity =
  | { name: string; type: 'enum';  values: string[] }
  | { name: string; type: 'regex'; pattern: string };

export type EdgeCondition =
  | `intent:${string}`      // "intent:agendar" ou "intent:none"
  | `entity:${string}`      // "entity:servico"
  | `context:${string}`;    // ex: "context:telefone empty"

export type Edge = {
  when: EdgeCondition;
  to: string;              // node.id destino
  set?: Record<string, string>;  // { servico: "{{entity}}" } ou valor literal
};

export type Node = {
  id: string;
  label: string;
  answer?: string;         // template, pode ter {{contexto.X}} e {{entity}}
  edges: Edge[];
  terminal?: boolean;      // se true, FSM encerra conversa
};

export type FlowDefinition = {
  intents: Intent[];
  entities?: Entity[];
  nodes: Node[];
  initial_hint?: string;   // usado apenas pelo editor para highlight
  ttl_minutes?: number;    // default 30
};

// Contexto da sessão chaveado por telefone (whatsapp)
export type SessionContext = Record<string, string>;

// Input que o FSM recebe do orquestrador (conversation.ts)
export type FsmInput = {
  text: string;            // mensagem original do usuário
  intent: string;          // classificada pelo NLU
  score: number;
  entities: Record<string, string | null>;  // extraídas pelo entities.ts
};

// Output do FSM — o que o orquestrador envia pro usuário
export type FsmOutput = {
  nextNodeId: string;
  text: string;            // answer renderizada com templates
  isTerminal: boolean;
};
