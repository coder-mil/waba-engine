/**
 * NLP Engine — matching de perguntas por keywords + similaridade.
 * Respostas com support para Quick Reply Buttons do WhatsApp.
 */

import { getTrainedAnswers, getNlpFlowById } from './db';

export type NlpAnswer = {
  id: number;
  question: string;
  keywords: string[];
  answer: string;
  buttons: Array<{ label: string; value: string }>;
};

export type MatchResult = {
  answer: NlpAnswer | null;
  matchedBy: 'keyword' | 'question' | 'default';
  score: number;
};

/** Normaliza texto: lowercase, remove pontuação extrena */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[!?.,;:]/g, '').trim();
}

/** Tokeniza em palavras */
function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(/\s+/).filter(Boolean));
}

/** Score de similaridade entre dois textos (Jaccard de palavras) */
function jaccardScore(input: string, target: string): number {
  const a = tokenize(input);
  const b = tokenize(target);
  if (a.size === 0 || b.size === 0) return 0;
  // Use Array.from instead of spread on Set (ES5 target)
  const aArr = Array.from(a);
  const bArr = Array.from(b);
  const intersection = aArr.filter(x => b.has(x)).length;
  const union = new Set(aArr.concat(bArr)).size;
  return union > 0 ? intersection / union : 0;
}

/** Score de keyword match: fração das keywords que aparecem no input */
function keywordScore(input: string, keywords: string[]): number {
  if (!keywords.length) return 0;
  const normInput = normalize(input);
  const matched = keywords.filter(kw => normInput.includes(normalize(kw)));
  return matched.length / keywords.length;
}

/**
 * Encontra a melhor resposta para um texto dentro de um flow.
 *
 * Estratégia:
 *  1. Keyword match — maior score de overlap entre input e keywords[]
 *  2. Question match — similaridade de Jaccard com o campo `question`
 *  3. Default answer do flow
 */
export async function matchAnswer(flowId: number, text: string): Promise<MatchResult> {
  const flow = await getNlpFlowById(flowId);
  if (!flow) return { answer: null, matchedBy: 'default', score: 0 };

  const answers = await getTrainedAnswers(flowId);
  if (!answers.length) {
    return {
      answer: { id: 0, question: '', keywords: [], answer: flow.default_answer, buttons: [] },
      matchedBy: 'default',
      score: 1,
    };
  }

  const input = normalize(text);
  let best: NlpAnswer | null = null;
  let bestScore = 0;
  let bestMethod: 'keyword' | 'question' = 'question';

  for (const row of answers) {
    const answer: NlpAnswer = {
      id: row.id,
      question: row.question,
      keywords: row.keywords || [],
      answer: row.answer,
      buttons: typeof row.buttons === 'string' ? JSON.parse(row.buttons) : (row.buttons || []),
    };

    // Keyword scoring
    const kwScore = keywordScore(text, answer.keywords);
    const qScore = jaccardScore(text, answer.question);

    // Usa o melhor entre keyword e question match
    const score = Math.max(kwScore, qScore);

    if (kwScore >= 0.5 && kwScore > bestScore) {
      bestScore = kwScore;
      best = answer;
      bestMethod = 'keyword';
    } else if (qScore > bestScore) {
      bestScore = qScore;
      best = answer;
      bestMethod = 'question';
    }
  }

  if (best && bestScore >= 0.2) {
    return { answer: best, matchedBy: bestMethod, score: bestScore };
  }

  return {
    answer: { id: 0, question: '', keywords: [], answer: flow.default_answer, buttons: [] },
    matchedBy: 'default',
    score: 1,
  };
}
