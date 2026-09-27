import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { pathToFileURL } from 'node:url';

const endpoint = 'https://mcp.itjuzi.com/mcp';
const wanted = new Set(['search_tags', 'search_companies', 'get_company_profile', 'get_company_funding_events', 'resolve_companies']);

export async function connectItjuzi(key = process.env.ITJUZI_MCP_API_KEY) {
  if (!key) throw new Error('ITJUZI_MCP_API_KEY 未配置。');
  const client = new Client({ name: 'jev100-company-demo', version: '0.1.0' }, { versionNegotiation: { mode: 'legacy' } });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), { authProvider: { token: async () => key } });
  await client.connect(transport);
  return client;
}

export async function callItjuzi(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${result.content?.filter(item => item.type === 'text').map(item => item.text).join(' ').slice(0, 500) || 'MCP tool error'}`);
  if (result.structuredContent) return result.structuredContent;
  const texts = result.content?.filter(item => item.type === 'text').map(item => item.text) || [];
  if (texts.length === 1) {
    try { return JSON.parse(texts[0]); } catch { return texts[0]; }
  }
  return texts.map(text => { try { return JSON.parse(text); } catch { return text; } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const client = await connectItjuzi();
  try {
    const { tools } = await client.listTools();
    process.stdout.write(`${JSON.stringify(tools.filter(tool => wanted.has(tool.name)).map(({ name, inputSchema }) => ({ name, inputSchema })), null, 2)}\n`);
  } finally { await client.close(); }
}
