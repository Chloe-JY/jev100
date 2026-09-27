# Enterprise similarity lane

This lane mirrors JEV 100's project search: retrieve and normalize **up to 100 real companies**, compare each against the user's business, and return the five most structurally similar eligible companies. The built-in two cases are only a small request-path preview; they are not the company candidate pool.

Input is a current business idea or company description with `customer`, `pain`, `product`, `payer`, `delivery`, and `acquisition`, plus a set of real company records with `snapshotDate`, `earlyFacts`, and `earlySources`. The schema is compatible with `StartupMirror/data/cases.json`. Each fact must be true **as of its snapshot date**, supported by a link; unknown fields are explicit `null` in all six keys. Every record needs a unique ID and company name. Do not put later outcomes, company names or reputations into Jev's comparison state.

Run `node scripts/company-match.mjs --input=companies.json --out=matches.json` with a UTF-8 file shaped like:

```json
{
  "idea": { "customer": "...", "pain": "...", "product": "...", "payer": "...", "delivery": "...", "acquisition": "..." },
  "companies": [
    { "id": "company-2021", "name": "Company", "snapshotDate": "2021-03-31",
      "earlyFacts": { "customer": "...", "pain": "...", "product": "...", "payer": "...", "delivery": "...", "acquisition": null },
      "earlySources": [{ "label": "Dated filing, section and page", "url": "https://..." }] }
  ]
}
```

The script validates the entire pool before requests: 1–100 companies, unique IDs and names, all six fact keys, a valid snapshot date and at least one HTTPS early source. It then makes one Jev request per company, with a maximum of five concurrent calls. For the full demonstration, collect **100** records and report if fewer were actually found; never fabricate a company to fill the number. An unverified `earlySources` list should be resolved before publishing a result. The page supports uploading this JSON format; the sample download contains two real cases only to show the format.

The six dimensions compare customer and buyer, pain and use situation, product job, payer and revenue structure, delivery and operating dependencies, and acquisition channel. Jev returns a 0–2 score for each dimension that has facts on both sides: 0 clearly different, 1 overlap with a material difference, 2 substantially similar. Fractional scores are allowed. Similarity is `sum(scores) / (2 × number of scored dimensions)`. Missing dimensions are skipped, never scored zero. To avoid a one-dimension exact match outranking stronger documented candidates, Top 5 eligibility requires at least four scored dimensions when the idea supplies four or more; otherwise all supplied idea dimensions must be comparable. Report `candidateCount`, `scoredCount`, `eligibleCount`, failures and actual Top 5 size.

This is an **independent retrieval/ranking lane**. Source selection may choose SEC EDGAR, Companies House, OpenCorporates or another source fitting the jurisdiction, but the catalog entry is not evidence that an adapter is live. An LLM should plan queries and use a real search tool/source adapter to retrieve company IDs and original links; then normalize and verify each company's dated business facts before Jev ranking. For a multi-company run, align stages and snapshot dates as closely as evidence allows, and disclose meaningful age or geography differences. The existing two-case preview validates the comparison call only; it is not a 100-company search.

### IT桔子 MCP interactive lane

When `ITJUZI_MCP_API_KEY` is configured, the company-source router may include IT桔子 as a licensed source. The included `scripts/itjuzi-vertical.mjs` uses the actual MCP sequence: `search_tags` for `具身智能` and `工业机器人`, `search_companies` with the tag intersection, `get_company_profile` with `description` explicitly requested for a small set, then `get_company_funding_events` for the first ranked result. Run the compact output entry point with `node scripts/itjuzi-demo.mjs`. `resolve_companies` should be used when the user starts with a company name rather than a tag search. It keeps the returned profiles in process memory only; the demo does not batch-export or maintain an IT桔子 database. [IT桔子 MCP's public client documentation](https://github.com/lgyers/itjuzi-mcp) describes the research-oriented access and its batch-export/system-ingest restriction.

Normalize each current profile to `identity`, `recallFeatures`, `similarityEvidence`, `fundingEvents`, `source`, and `profileUrl`. Tags and industry are recall features; fundraising is stage context. The profile description is the only field this demo currently treats as independently evidenced product text. `customer`, `pain`, `payerAndPayment`, `delivery`, and `acquisition` remain `null`, even if a sentence hints at one, until that fact is independently extracted and sourced. Jev scores **product only**, 0–2, for every profiled candidate. Show its score and `coverage: 1/6`; `fullSimilarity` stays `null`. This produces a product reference ranking, not a six-dimensional enterprise similarity ranking. Current MCP descriptions must never be silently reused as historical snapshots.

The user-facing shortlist shows order, the six scored dimensions, aggregate similarity **when coverage is sufficient**, coverage, structurally similar points, material differences, missing facts and links to early sources. For a one-dimension MCP product ranking, show only that product score and mark the full six-dimension similarity unavailable. Later company outcomes can be shown in a separate, explicitly dated panel after ranking, but never used in source retrieval, Jev state or similarity scoring. Similarity is not a prediction of future results and is unrelated to the eight-dimension Idea maturity score.
