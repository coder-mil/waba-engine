/**
 * scripts/migrate-flow.ts
 *
 * Converte o flow do Dometts Barbershop (ID=5 por padrão) do formato antigo
 * (intents com `answer` + `anything_else`) para o novo formato v3
 * (intents sem `answer` + `nodes` com `edges` + nó `fallback`).
 *
 * Uso:
 *   npx ts-node scripts/migrate-flow.ts              # dry-run, flow 5
 *   npx ts-node scripts/migrate-flow.ts 5 --apply    # aplica de fato
 *   npx ts-node scripts/migrate-flow.ts 7 --apply    # outro flow id
 *
 * Variáveis de ambiente:
 *   DATABASE_URL   connection string do PostgreSQL (obrigatória).
 *                  Se não estiver setada, o script aborta com erro claro.
 *
 * Requisitos:
 *   - O script preserva a definition antiga em `definition._old_format_definition`
 *     antes de sobrescrever, de forma idempotente.
 *   - Em dry-run, nenhuma escrita é feita.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ─── Carrega .env manualmente (sem dependência de dotenv) ────────────────────
// Lê um .env simples (formato KEY=VALUE por linha) se existir, mas NÃO
// sobrescreve variáveis já presentes em process.env. Não faz parse avançado
// (sem aspas, sem expansão) — só o suficiente para uso local.
function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}
loadDotEnv();

// ─── Constantes ──────────────────────────────────────────────────────────────
const PHRASE_EXPANSIONS: Record<string, string> = {
  // saudações
  'oi': 'oi tudo bem',
  'olá': 'olá bom dia',
  'ola': 'olá bom dia',
  'hey': 'hey como vai',
  'bom dia': 'bom dia como vai',
  'boa tarde': 'boa tarde tudo bem',
  'boa noite': 'boa noite como vai',
  'e aí': 'e aí tudo bem',
  'e ai': 'e aí tudo bem',
  'fala': 'fala galera',
  // despedidas
  'tchau': 'tchau até mais',
  'adeus': 'adeus até logo',
  'até logo': 'até logo valeu',
  'ate logo': 'até logo valeu',
  'até mais': 'até mais falou',
  'ate mais': 'até mais falou',
  'valeu': 'valeu obrigado',
  'falou': 'falou valeu',
  // preços
  'preço': 'qual o preço',
  'preco': 'qual o preço',
  'preços': 'quais os preços',
  'precos': 'quais os preços',
  'valor': 'qual o valor',
  'tabela': 'qual a tabela',
  // endereço
  'endereço': 'qual o endereço',
  'endereco': 'qual o endereço',
  'localização': 'qual a localização',
  'localizacao': 'qual a localização',
  'mapa': 'me manda o mapa',
  'onde fica': 'onde fica a barbearia',
  // serviços
  'serviços': 'quais os serviços',
  'servicos': 'quais os serviços',
  // agendar
  'agendar': 'quero agendar um horário',
  'horário': 'qual horário disponível',
  'horario': 'qual horário disponível',
};

const INTENTS_AGENDAR_FROM_SAUDACAO = ['intent:agendar'];
const INTENTS_DESPEDIDA = ['intent:despedida'];

// ─── Types ───────────────────────────────────────────────────────────────────
interface OldIntent {
  name: string;
  phrases: string[];
  answer?: string;
}
interface OldFlow {
  intents: OldIntent[];
  anything_else?: string;
}

interface NewEdge {
  when: string;
  to: string;
}
interface NewNode {
  id: string;
  label: string;
  answer: string;
  edges: NewEdge[];
  terminal?: boolean;
}
interface NewFlow {
  intents: { name: string; phrases: string[] }[];
  nodes: NewNode[];
  initial_hint: string;
  ttl_minutes: number;
}

// ─── Lógica de expansão de phrases ───────────────────────────────────────────
function expandPhrase(p: string): string {
  const lower = p.toLowerCase().trim();
  const words = lower.split(/\s+/);
  if (words.length <= 3) {
    const explicit = PHRASE_EXPANSIONS[lower];
    if (explicit) return explicit;
    // heurística genérica para phrases curtas sem mapeamento:
    // se tem 1 palavra, prefixa com "eu quero saber sobre"
    // se tem 2-3 palavras, deixa como está (não inventamos)
    if (words.length === 1) {
      return `eu quero saber sobre ${lower}`;
    }
  }
  return p;
}

// ─── Migração ────────────────────────────────────────────────────────────────
function migrate(old: OldFlow): NewFlow {
  const intents = old.intents.map((i) => ({
    name: i.name,
    phrases: i.phrases.map(expandPhrase),
  }));

  const nodes: NewNode[] = [];

  for (const i of old.intents) {
    const isDespedida = i.name === 'despedida';
    const isSaudacao = i.name === 'saudacao';
    const isAgendar = i.name === 'agendar';

    const node: NewNode = {
      id: i.name,
      label: i.name,
      answer: i.answer ?? '',
      edges: [],
    };

    if (isDespedida) {
      node.terminal = true;
    } else {
      // saudacao → agendar (atalho: se o cliente já começa pedindo agendamento)
      if (isSaudacao) {
        node.edges.push({ when: 'intent:agendar', to: 'agendar' });
      }
      // agendar → despedida (cliente pode encerrar após agendar)
      if (isAgendar) {
        node.edges.push({ when: 'intent:despedida', to: 'despedida' });
      }
      // qualquer nó não-terminal pode cair na despedida
      if (!isAgendar) {
        node.edges.push({ when: 'intent:despedida', to: 'despedida' });
      }
      // qualquer nó não-terminal pode cair no fallback
      node.edges.push({ when: 'intent:none', to: 'fallback' });
    }
    nodes.push(node);
  }

  // Nó fallback
  nodes.push({
    id: 'fallback',
    label: 'Não entendi',
    answer: old.anything_else ?? 'Desculpa, não entendi. Pode reformular?',
    edges: [{ when: 'intent:despedida', to: 'despedida' }],
  });

  return {
    intents,
    nodes,
    initial_hint: 'saudacao',
    ttl_minutes: 30,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const flowId = parseInt(process.argv[2] ?? '5', 10);
  const apply = process.argv[3] === '--apply';

  if (!process.env.DATABASE_URL) {
    console.error(
      '❌ DATABASE_URL não está definida.\n' +
        '   Exporte a variável antes de rodar o script:\n' +
        '     export DATABASE_URL=postgresql://user:pass@host:5432/db\n' +
        '   Ou crie um arquivo .env na raiz do projeto.'
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(
      'SELECT id, name, definition FROM flows WHERE id = $1',
      [flowId]
    );
    const flow = result.rows[0];
    if (!flow) {
      console.error(`❌ Flow ID=${flowId} não encontrado.`);
      process.exit(1);
    }

    const old: OldFlow = flow.definition;
    const intentCount = Array.isArray(old?.intents) ? old.intents.length : 0;
    const hasAnythingElse = typeof old?.anything_else === 'string';

    console.log(
      `Flow "${flow.name}" (ID=${flowId}) — formato antigo detectado`
    );
    console.log(`  Intents antigos: ${intentCount}`);
    console.log(`  anything_else:   ${hasAnythingElse ? 'sim' : 'não'}`);

    const newDef = migrate(old);
    const totalEdges = newDef.nodes.reduce(
      (acc, n) => acc + n.edges.length,
      0
    );

    console.log('\nNovo formato (v3):');
    console.log(`  Intents: ${newDef.intents.length}`);
    console.log(`  Nodes:   ${newDef.nodes.length}`);
    console.log(`  Edges:   ${totalEdges}`);
    for (const n of newDef.nodes) {
      const tag = n.terminal ? ' [terminal]' : '';
      console.log(
        `    - ${n.id} (${n.edges.length} edges${tag})`
      );
    }

    if (!apply) {
      console.log(
        `\n⚠️  DRY-RUN. Nada foi gravado.\n` +
          `   Para aplicar: npx ts-node scripts/migrate-flow.ts ${flowId} --apply`
      );
      return;
    }

    // 1) Backup: faz merge da definition antiga em `definition._old_format_definition`
    //    sem sobrescrever outros campos. O jsonb || jsonb concatena no nível raiz.
    await pool.query(
      `UPDATE flows
         SET definition = definition || jsonb_build_object('_old_format_definition', $1::jsonb),
             updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(old), flowId]
    );

    // 2) Sobrescreve a definition com a nova estrutura
    await pool.query(
      `UPDATE flows
         SET definition = $1::jsonb,
             updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(newDef), flowId]
    );

    console.log(
      `\n✅ Flow ID=${flowId} migrado. ` +
        `Intents: ${newDef.intents.length}, ` +
        `Nodes: ${newDef.nodes.length}, ` +
        `Edges: ${totalEdges}. ` +
        `Backup em definition._old_format_definition.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
