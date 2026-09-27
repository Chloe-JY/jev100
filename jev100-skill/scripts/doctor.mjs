import { SOURCES, CATEGORIES } from './route.mjs';

const ids = new Set();
const free = new Set(['public_api', 'free_key', 'public_web']);
const counts = { public_api: 0, free_key: 0, public_web: 0, reference_only: 0, optional_credit: 0 };
for (const source of SOURCES) {
  if (ids.has(source.id)) throw new Error(`Duplicate source: ${source.id}`);
  ids.add(source.id);
  if (!Object.hasOwn(counts, source.access)) throw new Error(`Unknown access: ${source.id}`);
  if (!Object.hasOwn(CATEGORIES, source.category) && source.category !== 'meta') throw new Error(`Unknown category: ${source.id}`);
  if (new URL(source.url).protocol !== 'https:') throw new Error(`Non-HTTPS URL: ${source.id}`);
  counts[source.access]++;
}
if (SOURCES.filter(source => free.has(source.access)).length !== 100) throw new Error('Expected 100 free-access candidate sources.');
process.stdout.write(`${JSON.stringify({ catalogEntries: SOURCES.length, candidateFreeAccess: 100, byAccess: counts, environment: { jevKeyConfigured: Boolean(process.env.AI_GATEWAY_API_KEY), search1ApiKeyConfigured: Boolean(process.env.SEARCH1API_API_KEY || process.env.SEARCH1API_KEY) }, liveSourceChecks: 'not run' }, null, 2)}\n`);
