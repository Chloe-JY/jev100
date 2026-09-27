# JEV 100 Skill

This folder is a standalone Codex skill. Upload the **entire folder** to GitHub; `SKILL.md` is its entry point. It turns a search goal into a source-linked shortlist: choose a source, collect real candidates, ask Jev the same evidence-based questions for each candidate, and return up to five results with verification steps.

## What works in this package

- A 104-entry source registry: 100 candidate free-access sources, three reference-only sources, and one optional paid aggregator. This is a routing catalog, **not** 100 implemented or tested scrapers.
- A working GitHub Search API adapter that collects up to 100 public repositories and README excerpts, then scores each repository with a separate Jev request.
- A separate six-dimension similarity ranker for a supplied, sourced company JSON pool (1–100 companies).
- An optional IT桔子 MCP demonstration that searches a small current company set and ranks the **product dimension only** when that is the only evidenced dimension. It does not export a 100-company database.

The local JEV 100 webpage and earlier benchmark files are in the separate StartupMirror application and are not needed to use this skill.

## Install

Requires Node.js 20 or newer. From this folder:

```bash
npm ci
node scripts/doctor.mjs
```

Set `AI_GATEWAY_API_KEY` in the **process environment** before a Jev run. `GITHUB_TOKEN` is optional for higher GitHub API limits. The IT桔子 demonstration also needs `ITJUZI_MCP_API_KEY`. Keep keys outside this folder and Git. See [setup](references/setup.md).

To install as a local Codex skill, clone this repository into your Codex skills directory as `jev100-skill` (`git clone https://github.com/Chloe-JY/jev100 jev100-skill`). `SKILL.md` sits at the repository root, so the clone is the skill folder.

## Run a GitHub shortlist

Plan search terms for the user's specific goal, then run:

```bash
node scripts/route.mjs "Find an open-source meeting assistant that works offline"
node scripts/github-fetch.mjs --query="offline meeting assistant" --query="local transcription action items" --limit=10 --out=candidates.json
node scripts/rank-jev.mjs --input=candidates.json --out=ranking.json --goal="Find a reusable offline meeting assistant" --must="Can run without cloud inference"
```

Increase `--limit` to 100 after checking search relevance, API availability and expected Jev cost. The first command routes source choice; `github-fetch.mjs` retrieves the actual records. A hard requirement with missing evidence is placed in a verification queue, rather than silently treated as met. Output JSON retains per-candidate scores and status.

## Run company similarity

Prepare a UTF-8 JSON file with `{ "idea": {...}, "companies": [...] }` using the schema in [company matching](references/company-matching.md). Every company needs a snapshot date, six explicitly present fact fields (unknown = `null`) and at least one dated source. Then run:

```bash
node scripts/company-match.mjs --input=companies.json --out=matches.json
```

This scores only dimensions with facts on both sides and reports coverage. The corpus is supplied by the user or a separately authorized retrieval step; the package does not bundle 100 verified companies.

For a small live IT桔子 product-only demonstration, after setting both keys:

```bash
node scripts/itjuzi-demo.mjs
```

The script prints a compact ranking and does not save MCP profiles to disk. See [company matching](references/company-matching.md) for its evidence limits and provider access terms.

## Files

- `SKILL.md` — agent instructions and decision boundaries.
- `references/` — source registry, setup, pipeline, company schema and evaluation guidance.
- `scripts/` — source routing, checks, GitHub retrieval, Jev ranking and company matching.
- `package-lock.json` — reproducible MCP client installation.

The `.gitignore` protects local keys, generated candidate snapshots, rankings and dependencies from an ordinary `git add`.
