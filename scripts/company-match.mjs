import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gatewayCall } from './route.mjs';

export const COMPANY_DIMENSIONS = Object.freeze([
  { id: 'customer', label: '客户', field: 'customer', meaning: '目标客户及购买决策者' },
  { id: 'pain', label: '痛点', field: 'pain', meaning: '客户问题和使用场景' },
  { id: 'product', label: '产品', field: 'product', meaning: '产品实际完成的任务' },
  { id: 'payment', label: '付费', field: 'payer', meaning: '付款方和收入结构' },
  { id: 'delivery', label: '交付', field: 'delivery', meaning: '产品交付方式和运营依赖' },
  { id: 'acquisition', label: '获客', field: 'acquisition', meaning: '客户获取渠道和流程' },
]);

const criteria = [
  'The business structures for this dimension are clearly different.',
  'They overlap, but a material structural difference remains.',
  'Their business structures are substantially similar in this dimension.',
];

export function cleanCompanyIdea(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('请输入要匹配的企业或创业想法。');
  const fields = Object.fromEntries(COMPANY_DIMENSIONS.map(item => [item.field, item]));
  const idea = {};
  for (const field of Object.keys(fields)) {
    const value = input[field];
    if (value != null && typeof value !== 'string') throw new Error(`输入字段 ${field} 必须是文字。`);
    idea[field] = (value || '').trim().slice(0, 900);
  }
  if (COMPANY_DIMENSIONS.filter(item => idea[item.field]).length < 2) throw new Error('至少填写两个业务事实，才能比较企业相似度。');
  return idea;
}

export function validateCompanyPool(companies) {
  if (!Array.isArray(companies) || !companies.length || companies.length > 100) throw new Error('企业候选库须包含 1–100 条记录。');
  const ids = new Set();
  const names = new Set();
  return companies.map((company, index) => {
    const place = `第 ${index + 1} 条企业`;
    if (!company || typeof company !== 'object' || Array.isArray(company)) throw new Error(`${place}格式不正确。`);
    if (typeof company.id !== 'string' || !company.id.trim() || company.id.length > 120 || ids.has(company.id)) throw new Error(`${place}缺少唯一 id。`);
    ids.add(company.id);
    if (typeof company.name !== 'string' || !company.name.trim() || company.name.length > 160) throw new Error(`${place}缺少企业名称。`);
    const normalizedName = company.name.trim().toLocaleLowerCase();
    if (names.has(normalizedName)) throw new Error(`${place}与已有企业名称重复，请先去重。`);
    names.add(normalizedName);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(company.snapshotDate || '') || Number.isNaN(Date.parse(company.snapshotDate))) throw new Error(`${place}缺少有效快照日期。`);
    if (!company.earlyFacts || typeof company.earlyFacts !== 'object' || Array.isArray(company.earlyFacts)) throw new Error(`${place}缺少 earlyFacts。`);
    const facts = {};
    for (const { field } of COMPANY_DIMENSIONS) {
      if (!Object.hasOwn(company.earlyFacts, field)) throw new Error(`${place}的 earlyFacts 缺少 ${field}；未知请填 null。`);
      const value = company.earlyFacts[field];
      if (value != null && (typeof value !== 'string' || value.length > 2500)) throw new Error(`${place}的 ${field} 必须是文字或 null，且不超过 2500 字。`);
      facts[field] = value?.trim() || null;
    }
    if (!Array.isArray(company.earlySources) || !company.earlySources.length) throw new Error(`${place}缺少早期事实来源。`);
    const sources = company.earlySources.map(source => {
      if (typeof source?.label !== 'string' || !source.label.trim() || typeof source.url !== 'string') throw new Error(`${place}的来源格式不正确。`);
      let url;
      try { url = new URL(source.url); } catch { throw new Error(`${place}的来源链接不正确。`); }
      if (url.protocol !== 'https:') throw new Error(`${place}的来源必须是 HTTPS 链接。`);
      return { label: source.label.trim(), url: url.href };
    });
    return { id: company.id, name: company.name.trim(), sector: typeof company.sector === 'string' ? company.sector.trim() : null, snapshotDate: company.snapshotDate, earlyFacts: facts, earlySources: sources };
  });
}

export function companyQuestions(idea, earlyFacts) {
  return Object.fromEntries(COMPANY_DIMENSIONS.filter(item => idea[item.field] && earlyFacts?.[item.field]).map(item => [item.id, {
    type: 'score',
    instructions: `Compare the current idea and historical company in ${item.meaning}. Judge business structure using only the supplied facts. Ignore company identity, reputation, and any events after the snapshot date. Do not infer missing information.`,
    criteria,
  }]));
}

export function companyState(idea, company) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(company.snapshotDate || '')) throw new Error('企业缺少有效快照日期。');
  // Whitelist facts and date: name, sources and later outcomes never reach Jev.
  const facts = Object.fromEntries(COMPANY_DIMENSIONS.map(item => [item.field, company.earlyFacts?.[item.field] || null]));
  return JSON.stringify({ currentIdea: idea, historicalCompanyAsOf: company.snapshotDate, historicalCompanyFacts: facts });
}

export async function matchCompany(ideaInput, company, call = gatewayCall) {
  const idea = cleanCompanyIdea(ideaInput);
  const questions = companyQuestions(idea, company.earlyFacts);
  const dimensions = COMPANY_DIMENSIONS.map(item => ({
    id: item.id, label: item.label, ideaFact: idea[item.field] || null,
    companyFact: company.earlyFacts?.[item.field] || null,
    available: Boolean(questions[item.id]),
  }));
  if (!Object.keys(questions).length) return {
    id: company.id, name: company.name, snapshotDate: company.snapshotDate,
    sources: company.earlySources || [], similarity: null, coverage: 0,
    dimensions: dimensions.map(item => ({ ...item, score: null, status: 'missing_fact' })),
  };
  const result = await call({ state: companyState(idea, company), questions });
  for (const item of dimensions) {
    if (!item.available) { item.score = null; item.status = 'missing_fact'; continue; }
    const score = result.answers?.[item.id]?.score;
    if (!Number.isFinite(score) || score < 0 || score > 2) throw new Error(`Jev 返回了无效的企业相似度分数：${item.id}。`);
    item.score = score;
    item.status = 'scored';
  }
  const scored = dimensions.filter(item => item.status === 'scored');
  return {
    id: company.id, name: company.name, snapshotDate: company.snapshotDate,
    sources: company.earlySources || [],
    similarity: scored.reduce((total, item) => total + item.score, 0) / (2 * scored.length),
    coverage: scored.length, dimensions, latencyMs: result.latencyMs, usage: result.usage || null,
  };
}

export async function matchCompanies(ideaInput, companies, call = gatewayCall) {
  const idea = cleanCompanyIdea(ideaInput);
  const pool = validateCompanyPool(companies);
  const results = Array(pool.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(5, pool.length) }, async () => {
    while (next < pool.length) {
      const index = next++;
      try { results[index] = await matchCompany(idea, pool[index], call); }
      catch (error) { results[index] = { id: pool[index].id, name: pool[index].name, error: error.message }; }
    }
  }));
  const availableIdeaDimensions = COMPANY_DIMENSIONS.filter(item => idea[item.field]).length;
  const minCoverage = Math.min(4, availableIdeaDimensions);
  const ranked = results.filter(item => !item.error && item.coverage >= minCoverage)
    .sort((a, b) => b.similarity - a.similarity || b.coverage - a.coverage || a.id.localeCompare(b.id));
  return {
    idea, candidateCount: pool.length, scoredCount: results.filter(item => !item.error && item.coverage).length,
    eligibleCount: ranked.length, minCoverage, top5: ranked.slice(0, 5), ranked,
    lowCoverage: results.filter(item => !item.error && item.coverage < minCoverage).map(item => ({ id: item.id, name: item.name, coverage: item.coverage })),
    errors: results.filter(item => item.error),
    method: '六维 0–2 Jev 业务结构相似度；仅双方都有事实的维度参与等权平均，缺失不计 0 分。为避免少量可比项占据前列，Top 5 至少需要指定覆盖度。相似度不预测成败。',
  };
}

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = option('input');
  const output = option('out');
  if (!input || !output) throw new Error('Provide --input=path --out=path. Input JSON contains {idea, companies}.');
  const payload = JSON.parse(await readFile(input, 'utf8'));
  const result = await matchCompanies(payload.idea, payload.companies);
  await writeFile(output, JSON.stringify(result, null, 2), 'utf8');
  process.stdout.write(`${JSON.stringify({ candidates: result.candidateCount, ranked: result.ranked.map(item => ({ id: item.id, similarity: item.similarity, coverage: item.coverage })) })}\n`);
}
