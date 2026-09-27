import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gatewayCall } from './route.mjs';

const scale = [
  'No supplied evidence supports a match.',
  'Only an adjacent or fragmentary match is evidenced.',
  'Most of the requirement is supported, with a material gap.',
  'The supplied evidence explicitly supports the requirement.',
];
const mustScale = [
  'The supplied evidence explicitly contradicts this requirement.',
  'The supplied evidence does not establish whether it is met.',
  'The requirement is partly supported but remains unverified.',
  'The supplied evidence explicitly supports this requirement.',
];
const baseQuestions = {
  task: { type: 'score', instructions: 'How directly does this candidate serve the goal? Judge only the supplied description and excerpt.', criteria: scale },
  constraints: { type: 'score', instructions: 'How well does the supplied evidence support the goal\'s constraints? Do not infer missing details.', criteria: scale },
  actionability: { type: 'score', instructions: 'Can the user take the stated next action with this candidate, based on the supplied evidence?', criteria: scale },
};
function option(name) {
  const prefix = `--${name}=`;
  return process.argv.filter(value => value.startsWith(prefix)).map(value => value.slice(prefix.length));
}
async function pooled(items, concurrency, fn) {
  const out = Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index], index);
    }
  }));
  return out;
}

export async function rankCandidates({ goal, records, mustHave = [], call = gatewayCall, concurrency = 3 }) {
  if (!goal?.trim() || !Array.isArray(records) || !records.length) throw new Error('A goal and nonempty real candidate records are required.');
  if (records.length > 100 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) throw new Error('At most 100 records and concurrency 1–5 are supported.');
  if (mustHave.length > 8) throw new Error('At most eight must-have conditions are supported.');
  const questions = { ...baseQuestions };
  mustHave.forEach((requirement, index) => {
    questions[`must${index + 1}`] = { type: 'score', instructions: `Does the supplied evidence satisfy this exact must-have: ${requirement}? Do not rely on outside knowledge.`, criteria: mustScale };
  });
  const started = performance.now();
  const results = await pooled(records, concurrency, async record => {
    if (!record.nativeId || !record.url || !record.url.startsWith('https://')) return { nativeId: record.nativeId || null, error: 'Missing native ID or canonical HTTPS URL' };
    try {
      const answer = await call({
        state: JSON.stringify({ goal, candidate: { nativeId: record.nativeId, title: record.title, url: record.url, description: record.description || '', evidenceExcerpt: record.readmeExcerpt || '', readmeUrl: record.readmeUrl || null } }),
        questions,
      });
      const scores = Object.fromEntries(Object.keys(questions).map(id => [id, answer.answers?.[id]?.score]));
      if (Object.values(scores).some(value => !Number.isFinite(value) || value < 0 || value > 3)) throw new Error('Jev returned a missing or invalid score');
      const hardStatus = mustHave.map((requirement, index) => ({ requirement, score: scores[`must${index + 1}`], status: scores[`must${index + 1}`] < 0.5 ? 'contradicted' : scores[`must${index + 1}`] < 2.5 ? 'unverified' : 'supported' }));
      const status = hardStatus.some(item => item.status === 'contradicted') ? 'excluded' : hardStatus.some(item => item.status === 'unverified') ? 'verification_queue' : 'eligible';
      const total = Math.round((.5 * scores.task + .3 * scores.constraints + .2 * scores.actionability) / 3 * 1000) / 10;
      return { nativeId: record.nativeId, title: record.title, url: record.url, readmeUrl: record.readmeUrl || null, scores, total, hardStatus, status, latencyMs: answer.latencyMs, usage: answer.usage || null };
    } catch (error) { return { nativeId: record.nativeId, error: error.message }; }
  });
  const eligible = results.filter(row => row.status === 'eligible').sort((a, b) => b.total - a.total || a.nativeId.localeCompare(b.nativeId));
  return {
    goal, mustHave, rubric: { weights: { task: .5, constraints: .3, actionability: .2 }, scale, mustScale },
    candidateCount: records.length, successfulCount: results.filter(row => !row.error).length,
    eligibleCount: eligible.length, latencyMs: Math.round(performance.now() - started),
    top5: eligible.slice(0, 5), results,
    caveat: 'Scores reflect only supplied evidence. Unverified must-haves are withheld from Top 5; verify original sources and test shortlisted candidates.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = option('input')[0];
  const output = option('out')[0];
  const goal = option('goal')[0];
  if (!input || !output || !goal) throw new Error('Provide --input=path --out=path --goal="...".');
  const snapshot = JSON.parse(await readFile(input, 'utf8'));
  const result = await rankCandidates({ goal, records: snapshot.records, mustHave: option('must') });
  await writeFile(output, JSON.stringify({ ...result, inputSnapshot: input, sourceRetrievedAt: snapshot.retrievedAt }, null, 2), 'utf8');
  process.stdout.write(`${JSON.stringify({ candidates: result.candidateCount, successful: result.successfulCount, eligible: result.eligibleCount, top5: result.top5.map(row => ({ nativeId: row.nativeId, total: row.total })), output })}\n`);
}
