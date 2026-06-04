import { NlpManager } from 'node-nlp';

let manager: NlpManager;

export async function initNLU() {
  manager = new NlpManager({
    languages: ['pt', 'en'],
    forceNER: true,
    nlu: { log: false },
    model: { fileName: '/tmp/model.nlp' },
  });

  // Intent base: saudações
  manager.addDocument('pt', 'oi', 'greetings.hello');
  manager.addDocument('pt', 'olá', 'greetings.hello');
  manager.addDocument('pt', 'hey', 'greetings.hello');
  manager.addDocument('pt', 'bom dia', 'greetings.hello');
  manager.addDocument('pt', 'boa tarde', 'greetings.hello');
  manager.addDocument('pt', 'boa noite', 'greetings.hello');
  manager.addDocument('pt', 'tchau', 'greetings.bye');
  manager.addDocument('pt', 'adeus', 'greetings.bye');
  manager.addDocument('pt', 'até logo', 'greetings.bye');

  // Intent base: suporte
  manager.addDocument('pt', 'ajuda', 'support.help');
  manager.addDocument('pt', 'não entendi', 'support.help');
  manager.addDocument('pt', 'problema', 'support.issue');

  // Answers
  manager.addAnswer('pt', 'greetings.hello', 'Olá! Como posso ajudar?');
  manager.addAnswer('pt', 'greetings.bye', 'Até logo! 👋');
  manager.addAnswer('pt', 'support.help', 'Claro! Como posso te ajudar?');
  manager.addAnswer('pt', 'support.issue', 'Entendi. Me conta mais sobre o problema.');

  // Train and save explicitly to /tmp
  await manager.train();
  await manager.save('/tmp/model.nlp');
  console.log('✅ NLU treinado');
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
    if (intent.answer) {
      manager.addAnswer('pt', intent.name, intent.answer);
    }
  }

  await manager.train();
  await manager.save('/tmp/model.nlp');
  console.log(`✅ NLU re-treinado com ${definition.intents.length} intents`);
}

export async function classifyIntent(text: string, lang = 'pt') {
  if (!manager) throw new Error('NLU não inicializado');
  const result = await manager.process(lang, text);
  return {
    intent: result.intent,
    score: result.score,
    answer: result.answer,
    entities: result.entities,
  };
}