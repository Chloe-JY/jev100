import { connectItjuzi } from './itjuzi-mcp.mjs';
import { runItjuziVertical } from './itjuzi-vertical.mjs';
import { gatewayCall } from './route.mjs';

if (!process.env.AI_GATEWAY_API_KEY) throw new Error('Set AI_GATEWAY_API_KEY before running this Jev demonstration.');
const client = await connectItjuzi();
try {
  const result = await runItjuziVertical({ client, jevCall: gatewayCall });
  process.stdout.write(`${JSON.stringify({
    scenario: result.scenario.title,
    retrievedAt: result.retrievedAt,
    searchedCount: result.searchedCount,
    profiledCount: result.profiledCount,
    rankingBasis: result.rankingBasis,
    top5: result.top5.map(item => ({
      companyId: item.companyId,
      name: item.name,
      productScore: item.productScore,
      coverage: item.coverage,
      fullSimilarity: item.fullSimilarity,
      profileUrl: item.profileUrl,
    })),
    latencyMs: result.latencyMs,
    mcpCallCount: result.mcpCallCount,
    jevCallCount: result.jevCallCount,
  }, null, 2)}\n`);
} finally {
  await client.close();
}
