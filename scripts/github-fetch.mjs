import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.filter(value => value.startsWith(prefix)).map(value => value.slice(prefix.length));
}

export async function fetchGithub({ queries, limit = 100, token = process.env.GITHUB_TOKEN, fetcher = fetch }) {
  if (!Array.isArray(queries) || !queries.length || queries.some(query => !query.trim())) throw new Error('Provide at least one --query planned from the goal.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be 1–100.');
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'jev100-skill', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const groups = [];
  for (const query of queries) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=100`;
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`GitHub search HTTP ${response.status} for query ${query}`);
    const body = await response.json();
    groups.push({ query, totalCount: body.total_count, incompleteResults: body.incomplete_results, items: body.items || [] });
  }
  const seen = new Set();
  const selected = [];
  const length = Math.max(...groups.map(group => group.items.length));
  for (let index = 0; index < length && selected.length < limit; index++) {
    for (const group of groups) {
      const item = group.items[index];
      if (!item || item.archived || item.fork || seen.has(item.full_name?.toLowerCase())) continue;
      seen.add(item.full_name.toLowerCase());
      selected.push({ item, query: group.query, position: index + 1 });
      if (selected.length >= limit) break;
    }
  }
  const records = Array(selected.length);
  let next = 0;
  async function worker() {
    while (next < selected.length) {
      const index = next++;
      const { item, query, position } = selected[index];
    const readmeUrl = `https://raw.githubusercontent.com/${item.full_name}/${encodeURIComponent(item.default_branch || 'main')}/README.md`;
    let readme = '';
    try {
      const response = await fetcher(readmeUrl, { signal: AbortSignal.timeout(12000) });
      if (response.ok) readme = (await response.text()).slice(0, 100000);
    } catch { /* A missing README remains missing evidence. */ }
      records[index] = {
      source: 'github', nativeId: item.full_name, title: item.full_name, url: item.html_url,
      description: item.description || '', readmeUrl: readme ? readmeUrl : null,
      readmeExcerpt: readme.slice(0, 4000), readmeChars: readme.length,
      stars: item.stargazers_count, updatedAt: item.updated_at,
      license: item.license?.spdx_id || null, query, searchPosition: position,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, selected.length) }, worker));
  return {
    source: 'github', retrievedAt: new Date().toISOString(), requestedCount: limit,
    actualCount: records.length, shortfall: records.length < limit ? 'Search queries returned fewer distinct, non-archived, non-fork repositories.' : null,
    queries: groups.map(({ query, totalCount, incompleteResults }) => ({ query, totalCount, incompleteResults })),
    records,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const queries = option('query');
  const limit = Number(option('limit')[0] || 100);
  const output = option('out')[0];
  if (!output) throw new Error('Provide --out=path for the candidate JSON snapshot.');
  const result = await fetchGithub({ queries, limit });
  await writeFile(output, JSON.stringify(result, null, 2), 'utf8');
  process.stdout.write(`${JSON.stringify({ source: result.source, requestedCount: limit, actualCount: result.actualCount, queries: result.queries, output })}\n`);
}
