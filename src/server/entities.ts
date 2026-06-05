// entities.ts
// Extrator de entities (enum + regex) a partir do texto do usuário.
// Usado pelo orquestrador (conversation.ts) durante a transição do FSM,
// alimentando o campo `entities: Record<string, string | null>` do FsmInput.

import type { Entity } from './types/flow';

/**
 * Tenta extrair do `text` cada entity cujo nome está em `requiredNames`.
 *
 * @param text           Mensagem original do usuário.
 * @param entities       Lista completa de entities declaradas no flow.
 * @param requiredNames  Nomes das entities que o nó atual referencia nos edges
 *                       (evita trabalho desnecessário em entities não usadas).
 * @returns              Objeto chaveado por cada nome em `requiredNames`:
 *                       `string` se houve match, `null` caso contrário.
 *                       Retorna `{}` quando `requiredNames` é vazio.
 */
export function extractEntities(
  text: string,
  entities: Entity[] = [],
  requiredNames: string[] = []
): Record<string, string | null> {
  const out: Record<string, string | null> = {};

  for (const name of requiredNames) {
    const entity = entities.find((e) => e.name === name);
    if (!entity) {
      // Entity requerida não foi declarada no flow: nada a extrair.
      out[name] = null;
      continue;
    }
    out[name] = matchEntity(text, entity);
  }

  return out;
}

/**
 * Aplica a estratégia de match adequada ao `type` da entity.
 *
 *  - 'enum':  case-insensitive, retorna o valor EXATO do array `values`
 *             (não o que o usuário digitou).
 *  - 'regex': testa o pattern contra o texto inteiro. Se casar, devolve
 *             o texto original (já validado); senão, null.
 */
function matchEntity(text: string, entity: Entity): string | null {
  if (entity.type === 'enum') {
    const lower = text.toLowerCase();
    for (const v of entity.values) {
      if (lower.includes(v.toLowerCase())) {
        // Devolve o valor canônico, não o trecho digitado pelo usuário.
        return v;
      }
    }
    return null;
  }

  if (entity.type === 'regex') {
    try {
      const re = new RegExp(entity.pattern);
      return re.test(text) ? text : null;
    } catch {
      // Pattern inválido: falhar de forma segura sem quebrar o fluxo.
      return null;
    }
  }

  return null;
}
