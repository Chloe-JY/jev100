# Validating JEV 100

Model-versus-model or model-versus-one-AI-judge Spearman correlation measures agreement. It does not prove that the source catalog, rubric, weights or selected Top 5 help the user. Score confidence is not an observed success probability unless calibrated on external outcomes.

Use three layers:

1. **Invariants:** removing evidence for a required feature must not improve that feature's score; renaming or reordering unrelated records should not change independent judgments. Run controlled changes on real records.
2. **Source-grounded checks:** inspect full documents, not only leading snippets. Verify hard constraints, current license/terms and item availability. Missing evidence is distinct from a contradiction.
3. **External utility:** for repositories measure successful installation and required workflow completion; for papers measure whether a method can be reproduced or directly used; for jobs measure whether the vacancy is current and meets the stated requirements. Compare Top 5 success, time to useful candidate and NDCG@5 against baselines. Split by **goal**, not just random items from the same goal, to test transfer.

The 2026-09-27 GitHub 100-repository experiment used one fixed offline-meeting goal. Jev's score Spearman against a single AI judge was 0.893; Kimi 0.874, Qwen 0.852, DeepSeek 0.816. Those labels used compressed README evidence, not independent human or runtime truth. On a six-positive binary excerpt criterion, DeepSeek's AUC was higher. See the sibling application docs `docs/github-judge-100.md`. Do not claim that this single-domain result proves cross-domain ranking quality.

Do not fit score weights and then evaluate them on the same goal. Clicks and saves are useful feedback but have position bias; record which candidates were shown and, where practical, compare randomized or interleaved rankings before learning from implicit feedback.
