import { callItjuzi } from './itjuzi-mcp.mjs';

export const VERTICAL_DEMO = Object.freeze({
  title: '制造业柔性上下料与分拣机器人',
  idea: {
    customer: '多品种、小批量的制造工厂及其自动化负责人。',
    pain: '人工上下料、分拣和换线耗时，复杂零件难以稳定自动化。',
    product: '用视觉感知与具身智能控制机械臂，完成工业产线柔性上下料、零件抓取与分拣。',
    payer: '制造企业购买或租赁机器人系统，并按部署与维护服务付款。',
    delivery: '机械臂、视觉传感器、本地控制软件与现场集成交付。',
    acquisition: '通过工业系统集成商和标杆产线试点获取工厂客户。',
  },
});

const criteria = [
  'The described product serves a clearly different task.',
  'It overlaps in robotics or manufacturing, but the core product task differs materially.',
  'The described product directly supports flexible industrial loading, grasping or sorting.',
];
const data = response => response?.result?.data ?? response?.data ?? null;
const limit = 6;

export async function runItjuziVertical({ client, jevCall, mcpCall = callItjuzi }) {
  const started = performance.now();
  const tagCalls = [];
  for (const keyword of ['具身智能', '工业机器人']) {
    const tags = data(await mcpCall(client, 'search_tags', { keyword, limit: 10 })) || [];
    const exact = tags.find(item => item.tag_name === keyword);
    if (!exact?.tag_id) throw new Error(`IT桔子未找到精确标签：${keyword}。`);
    tagCalls.push({ keyword, tagId: exact.tag_id });
  }
  const search = data(await mcpCall(client, 'search_companies', {
    tag_ids: tagCalls.map(item => item.tagId), tag_match_mode: 'intersection', location: 'in', page_size: 20,
  }));
  const found = Array.isArray(search?.items) ? search.items : [];
  const candidates = found.filter(item => item.company_id && item.sub_scope_name === '工业机器人').slice(0, limit);
  if (!candidates.length) throw new Error('标签交集没有返回工业机器人公司。');

  const profiles = [];
  for (const item of candidates) {
    const profile = data(await mcpCall(client, 'get_company_profile', {
      company_id: item.company_id,
      fields: ['company_id', 'company_name', 'registered_name', 'scope_name', 'sub_scope_name', 'province', 'city', 'born_year', 'born_month', 'description'],
    }));
    if (!profile?.description || profile.company_id !== item.company_id) continue;
    profiles.push({
      companyId: item.company_id, name: profile.company_name || item.company_name,
      identity: { registeredName: profile.registered_name || null, region: [profile.province, profile.city].filter(Boolean).join('') || null, founded: profile.born_year ? `${profile.born_year}-${String(profile.born_month || 1).padStart(2, '0')}` : null },
      recallFeatures: { industry: item.scope_name || null, subIndustry: item.sub_scope_name || null, tags: String(item.tags_text || '').split(',').filter(Boolean) },
      similarityEvidence: { customer: null, pain: null, product: profile.description, payerAndPayment: null, delivery: null, acquisition: null },
      evidenceSource: { label: 'IT桔子 MCP 公司画像 description（当前画像）', url: item.company_url || `https://www.itjuzi.com/company/${item.company_id}` },
      fundingEvents: [], source: 'itjuzi_mcp', profileUrl: item.company_url || `https://www.itjuzi.com/company/${item.company_id}`,
      coverage: 1, fullSimilarity: null,
    });
  }
  if (!profiles.length) throw new Error('候选公司没有返回可追溯的产品描述。');
  for (const profile of profiles) {
    const result = await jevCall({
      state: JSON.stringify({ targetProduct: VERTICAL_DEMO.idea.product, candidateProductEvidence: profile.similarityEvidence.product }),
      questions: { product: {
        type: 'score',
        instructions: 'Compare only the evidenced product function. Ignore industry tags, financing, company name and any unprovided business dimensions. The description may contain other statements; do not treat them as independently sourced six-dimension facts.',
        criteria,
      } },
    });
    const score = result.answers?.product?.score;
    if (!Number.isFinite(score) || score < 0 || score > 2) throw new Error(`Jev 未返回有效产品相似度：${profile.name}。`);
    profile.productScore = score;
    profile.productSimilarity = score / 2;
    profile.jevLatencyMs = result.latencyMs;
  }
  profiles.sort((a, b) => b.productScore - a.productScore || a.companyId - b.companyId);
  const first = profiles[0];
  const funding = data(await mcpCall(client, 'get_company_funding_events', { company_id: first.companyId, page_size: 5 }));
  first.fundingEvents = (funding?.items || []).map(item => ({ date: item.event_time?.slice(0, 10) || null, round: item.round_name || null, amount: item.amount || null, url: item.event_url || null }));
  return {
    scenario: VERTICAL_DEMO, retrievedAt: new Date().toISOString(), source: 'itjuzi_mcp',
    tags: tagCalls, searchedCount: found.length, profiledCount: profiles.length, moreCandidatesAvailable: Boolean(search?.next_cursor),
    rankingBasis: '产品单维相似度（0–2）；所有候选仅 1/6 项有独立画像证据，不生成六维总分。',
    top5: profiles.slice(0, 5), latencyMs: Math.round(performance.now() - started),
    mcpCallCount: 2 + 1 + candidates.length + 1, jevCallCount: profiles.length,
  };
}
