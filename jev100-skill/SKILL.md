---
name: jev100
description: Use when the user asks JEV 100 to select the best 5 from about 100 real projects, papers, companies, jobs, or public profiles. Route to a prepackaged source, collect source-linked candidates, score with Jev, and report evidence and limits.
---

# JEV 100

Turn a concrete goal into a source-linked shortlist. Do not treat Jev as a search engine: route the request, fetch real records with available search tools, then ask Jev typed questions about each record.

## Workflow

1. Parse the goal into candidate type, must-have conditions, exclusions, preferences and verification action. Ask about only a missing constraint that materially changes the search; otherwise keep unknowns explicit.
2. Read [references/sources.json](references/sources.json). Prefer an accessible source fitting the **candidate object**. `public_api`, `free_key` and `public_web` are catalog access paths, not proof of current availability. `reference_only` entries are context and require separate authorization/access checks. `optional_credit` requires a configured account. For a live two-stage Jev route use `node scripts/route.mjs "goal"` after setting `AI_GATEWAY_API_KEY`.
3. Use an LLM to plan queries and call the selected source's API, connector or authorized browser tool. For GitHub, run `node scripts/github-fetch.mjs --query="..." --query="..." --out=candidates.json`; add `--limit=10` for a small check. Collect up to 100 distinct real items with native IDs, canonical URLs, retrieval time and evidence. Record the actual count; never generate items from model memory to fill a quota. Follow source limits. If the chosen source fails, report failure and select a suitable alternate source.
4. Freeze the rubric before scoring. Hard exclusions and contradicted must-haves form a separate status; missing evidence is `unknown`. Run Jev independently per candidate for task fit, constraint evidence and actionability. For GitHub snapshots, run `node scripts/rank-jev.mjs --input=candidates.json --out=ranking.json --goal="..." --must="..."`. The first five eligible results are the Top 5. See [references/pipeline.md](references/pipeline.md).
5. Return the Top 5 with source links, component scores, evidence, hard-condition status and the next verification action. When nothing passes, say so. A high score is not proof of installation, reproducibility or suitability.

For **similar company** requests, use the separate [company matching rubric](references/company-matching.md). Retrieve and normalize up to 100 real companies, each with a dated business-fact snapshot and source links; never fill missing candidates from model memory. Run `node scripts/company-match.mjs --input=companies.json --out=matches.json` after verification. This scores customer, pain, product, payer, delivery and acquisition on a 0–2 similarity scale, skipping a dimension if either side lacks facts, and returns the eligible Top 5. It does not use the startup Idea quality rubric.

An authenticated IT桔子 MCP connection can provide interactive source discovery and current company profiles. Use `scripts/itjuzi-mcp.mjs` and `scripts/itjuzi-vertical.mjs` for a small current-profile demonstration. Route by tags and industry, explicitly request `description`, and keep unproven business dimensions `null`. A profile-only product ranking cannot be relabeled as full six-dimension similarity or historical matching. Follow the provider's research-use and export terms.

## Configuration and evaluation

Before a live run, follow [references/setup.md](references/setup.md). `AI_GATEWAY_API_KEY` is required for Jev. Public APIs can work without a search aggregator; Search1API is an optional credit-based fallback, configured separately. Keep keys server-side.

For claims about model quality or rubric weights, use [references/evaluation.md](references/evaluation.md). Correlation with another model or one AI judge is agreement, not ground truth. Keep an externally verified outcome set and compare Top 5 utility across tasks.
