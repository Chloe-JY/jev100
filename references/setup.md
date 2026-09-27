# Deployment and key setup

## First-run checklist

1. Run `node scripts/doctor.mjs` from this skill folder. It validates the 100 free-access candidate entries and reports only whether expected environment variables exist; it never prints a key.
2. Set `AI_GATEWAY_API_KEY` in the server or agent process environment for `typesafe-ai/jev`. Use Vercel AI Gateway's [key setup](https://vercel.com/docs/ai-gateway/getting-started).
3. Choose a retrieval path. The GitHub adapter works with public Search API access; `GITHUB_TOKEN` is optional and helps with rate limits. Other catalog entries are discovery candidates and need an access check and adapter before use. Services marked `free_key` require their own account and key before use.
4. Optionally set `SEARCH1API_API_KEY` (or the provider's documented `SEARCH1API_KEY`) for [Search1API](https://s1.dev/docs/get-started/quickstart). New accounts currently advertise 100 free credits; successful searches consume credits and further use can be paid. Show expected request count and remaining credits before a large run. Keep this optional service separate from the 100 free-access candidate sources.
5. Set spending and request limits on the providers. Do not put keys in HTML, the source catalog, Git commits, browser storage or chat.

For the optional IT桔子 MCP interactive company demo, set `ITJUZI_MCP_API_KEY` in the process environment. This is a separately authenticated data service, not one of the 100 open catalog adapters. The demo uses a small, transient profile set for human review and keeps it in process memory; check the provider's current access and usage terms before expanding it.

Run `npm ci` in this folder once to install the official MCP client declared in `package.json`. The source router and GitHub adapter themselves use Node's built-in APIs.

For one GitHub run at the full target size, source routing makes two Jev requests, and `rank-jev.mjs` makes one further Jev request per retrieved repository, up to 100. Start with `--limit=2` and inspect the output before running 100. GitHub search and README fetching are separate HTTP requests. The optional Search1API is not used by this adapter.

## Access states

`public_api`: public read API is documented; rate limits and terms still apply. `free_key`: free registration/key path is expected; check current eligibility and limits. `public_web`: public pages can be opened, but automated search or bulk extraction is not guaranteed. `reference_only`: included for domain awareness; no automatic access claim. `optional_credit`: optional metered aggregator.

The catalog is a **discovery registry**, not 100 tested adapters. Each source must pass a live access check before a run; record HTTP status, method, endpoint, terms checked at and actual item count. If the service requires login or blocks automation, use another source or stop that lane. Do not bypass access controls.
