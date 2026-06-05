import * as fs from 'fs';
import * as path from 'path';
import { NlpManager } from 'node-nlp';

let manager: NlpManager;

export async function initNLU() {
  try {
    manager = new NlpManager({
      languages: ['pt', 'en'],
      forceNER: true,
      nlu: { log: false },
    });

    // Nota: intents base removidas. O flow ativo é a única fonte de intents.
    // O NLU apenas classifica intent; a resposta vem do grafo de estados (FSM).
    // Se o flow não tiver intents, o NLU não sabe classificar nada (vai dar None).

    await manager.train();
    // save() sempre grava no CWD — usa chdir('/tmp') como workaround
    const cwd = process.cwd();
    process.chdir('/tmp');
    await manager.save(path.join('/tmp', 'model.nlp'));
    process.chdir(cwd);
    console.log('✅ NLU treinado');
  } catch (err) {
    console.warn('⚠️ NLU init failed:', err);
    manager = new NlpManager({ languages: ['pt', 'en'] });
  }
}

export async function trainFromFlow(definition: {
  intents?: Array<{ name: string; phrases: string[]; answer?: string }>;
}) {
  if (!manager) throw new Error('NLU não inicializado');
  if (!definition.intents) return;

  for (const intent of definition.intents) {
    for (const phrase of intent.phrases) {
      manager.addDocument('pt', phrase, intent.name);
    }
    // intent.answer é ignorado deliberadamente: a resposta vem do FSM, não do NLU.
  }

  await manager.train();
  const cwd = process.cwd();
  process.chdir('/tmp');
  await manager.save(path.join('/tmp', 'model.nlp'));
  process.chdir(cwd);
  console.log(`✅ NLU re-treinado com ${definition.intents.length} intents`);
}

export async function classifyIntent(text: string, lang = 'pt') {
  if (!manager) throw new Error('NLU não inicializado');
  const result = await manager.process(lang, text);
  console.log(`[NLU classifyIntent] text="${text}" → intent=${result.intent} answer=${result.answer} score=${result.score}`);
  return {
    intent: result.intent,
    score: result.score,
    answer: result.answer,
    entities: result.entities,
  };
}