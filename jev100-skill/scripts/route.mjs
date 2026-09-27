import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const catalog = JSON.parse(await readFile(new URL('../references/sources.json', import.meta.url), 'utf8'));
export const SOURCES = Object.freeze(catalog.sources);
export const CATEGORIES = Object.freeze({
  software: 'software projects, source code, AI models and reusable packages',
  research: 'papers, preprints, citations and research outputs',
  company: 'companies, filings, legal entities and procurement organisations',
  jobs: 'published job vacancies',
  people: 'public professional or researcher profiles',
  data: 'official statistics and public datasets',
  content: 'articles, books, discussions, news and media',
  patents: 'patents, standards and security advisories',
  nature: 'places, biodiversity, geoscience, music and film records',
});
const freeAccess = new Set(['public_api', 'free_key', 'public_web']);
const canRoute = (source, itjuziConfigured) => freeAccess.has(source.access) || (itjuziConfigured && source.id === 'itjuzi');

export function cleanGoal(value) {
  if (typeof value !== 'string') throw new Error('请输入搜索目标。');
  const goal = value.trim();
  if (goal.length < 12 || goal.length > 700) throw new Error('搜索目标长度须为 12–700 字。');
  return goal;
}

const levels = [
  'Cannot directly supply this type of candidate.',
  'Can supply only indirect background or adjacent candidate types.',
  'Can supply relevant candidates, but is not the most direct source.',
  'Direct primary source for this type of candidate and evidence.',
];
export function categoryQuestions() {
  return Object.fromEntries(Object.entries(CATEGORIES).map(([id, description]) => [id, {
    type: 'score',
    instructions: `Should candidate retrieval use ${id}? It contains ${description}. Judge the requested candidate object, not whether this subject is broadly related.`,
    criteria: levels,
  }]));
}
export function sourceQuestions(category, itjuziConfigured = Boolean(process.env.ITJUZI_MCP_API_KEY)) {
  const sources = SOURCES.filter(source => source.category === category && canRoute(source, itjuziConfigured));
  return Object.fromEntries(sources.map(source => [source.id, {
    type: 'score',
    instructions: `Rate whether ${source.name} is the right PRIMARY source to retrieve real ${source.kind} candidates for this goal. Public website: ${source.url}. Access mode: ${source.access}. Judge the requested candidate type and available evidence.`,
    criteria: levels,
  }]));
}
function scored(answers, records) {
  return records.map((record, index) => {
    const answer = answers?.[record.id];
    if (!Number.isFinite(answer?.score) || answer.score < 0 || answer.score > 3) throw new Error(`Jev 来源判断缺少 ${record.id} 的有效分数。`);
    return { ...record, score: answer.score, confidence: Number.isFinite(answer.confidence) ? answer.confidence : null, originalIndex: index };
  }).sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex).map(({ originalIndex, ...record }) => record);
}
export async function routeSource(goal, call, { itjuziConfigured = Boolean(process.env.ITJUZI_MCP_API_KEY) } = {}) {
  const cleaned = cleanGoal(goal);
  const categories = Object.entries(CATEGORIES).map(([id, description]) => ({ id, description }));
  const categoryResult = await call({ state: JSON.stringify({ goal: cleaned, candidateCategories: categories }), questions: categoryQuestions() });
  const categoryScores = scored(categoryResult.answers, categories);
  const category = categoryScores[0].id;
  const candidates = SOURCES.filter(source => source.category === category && canRoute(source, itjuziConfigured));
  const sourceResult = await call({ state: JSON.stringify({ goal: cleaned, selectedCategory: category, sources: candidates.map(({ id, name, kind, url, access }) => ({ id, name, kind, url, access })) }), questions: sourceQuestions(category, itjuziConfigured) });
  const sources = scored(sourceResult.answers, candidates);
  return {
    goal: cleaned, category, categoryScores, selected: sources[0].id, sources,
    relatedReferences: SOURCES.filter(source => source.category === category && source.access === 'reference_only' && !canRoute(source, itjuziConfigured)),
    catalogCount: SOURCES.length, freeCount: SOURCES.filter(source => freeAccess.has(source.access)).length,
    calls: [categoryResult.latencyMs, sourceResult.latencyMs], latencyMs: categoryResult.latencyMs + sourceResult.latencyMs,
    model: sourceResult.model || categoryResult.model,
    usage: [categoryResult.usage, sourceResult.usage],
  };
}

export async function gatewayCall(payload) {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) throw new Error('Set AI_GATEWAY_API_KEY in the environment before live routing.');
  const start = performance.now();
  const response = await fetch('https://ai-gateway.vercel.sh/v1/evaluate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'typesafe-ai/jev', ...payload }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Jev returned HTTP ${response.status}`);
  const result = await response.json();
  return { answers: result.answers, latencyMs: Math.round(performance.now() - start), model: result.model, usage: result.usage || null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const goal = process.argv.slice(2).join(' ');
  routeSource(goal, gatewayCall).then(result => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
