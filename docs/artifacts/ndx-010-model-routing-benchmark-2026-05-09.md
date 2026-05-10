# NDX-010 model-routing benchmark

Generated: 2026-05-10T05:25:24.385Z

## Methodology

- Offline mocked-AI benchmark derived from the NDX-008 handoff requirements because no committed NDX-008 harness artifact exists in this checkout.
- Uses the real `routeBatchParserInput` local/batch router and the real `runFastThenDeepParserModelRouting` policy.
- Provider calls are mocked; latency is harness/runtime latency only, not Gemini SLA.
- Static comparison treats each AI fallback as direct deep Pro. Routed comparison tries Flash first, then Pro only when fast extraction is ambiguous.
- Weighted cost units are planning-only: Flash=1, Pro=10. They are not provider billing truth.

## Totals

- Static deep Pro: 4 AI calls, 4 deep selections, 40 weighted cost units.
- Fast routing: 6 AI calls, 2 fast selections, 2 deep selections, 24 weighted cost units.

| Case | Mode | Route | AI calls | Cost units | Selected tier | Final model | Latency ms | Results | Review results | Batch local/AI | Escalation reasons |
|---|---|---|---:|---:|---|---|---:|---:|---:|---|---|
| simple expense | static_deep_pro | local_save | 0 | 0 | not_applicable | n/a | 4 | 1 | 0 | n/a/n/a | local_finance_fast_path, local_finance_expense |
| simple expense | fast_then_deep_routing | local_save | 0 | 0 | not_applicable | n/a | 1 | 1 | 0 | n/a/n/a | local_finance_fast_path, local_finance_expense |
| clear local batch | static_deep_pro | local_save | 0 | 0 | not_applicable | n/a | 3 | 3 | 0 | 3/0 | batch_input, batch_items_3, batch_local_items_3, batch_ai_items_0 |
| clear local batch | fast_then_deep_routing | local_save | 0 | 0 | not_applicable | n/a | 1 | 3 | 0 | 3/0 | batch_input, batch_items_3, batch_local_items_3, batch_ai_items_0 |
| ambiguous note fast ok | static_deep_pro | deep_ai | 1 | 10 | deep_parse | gemini-2.5-pro | 0 | 1 | 0 | n/a/n/a | no_local_intent_match |
| ambiguous note fast ok | fast_then_deep_routing | deep_ai | 1 | 1 | fast_extraction | gemini-2.5-flash | 1 | 1 | 0 | n/a/n/a | none |
| ambiguous reimbursement deep | static_deep_pro | deep_ai | 1 | 10 | deep_parse | gemini-2.5-pro | 0 | 1 | 0 | n/a/n/a | no_local_intent_match |
| ambiguous reimbursement deep | fast_then_deep_routing | deep_ai | 2 | 11 | deep_parse | gemini-2.5-pro | 0 | 1 | 0 | n/a/n/a | fast_unknown_result, fast_below_min_confidence, fast_needs_review |
| mixed batch one leftover fast ok | static_deep_pro | deep_ai | 1 | 10 | deep_parse | gemini-2.5-pro | 1 | 3 | 0 | 2/1 | batch_input, batch_items_3, batch_local_items_2, batch_ai_items_1 |
| mixed batch one leftover fast ok | fast_then_deep_routing | deep_ai | 1 | 1 | fast_extraction | gemini-2.5-flash | 1 | 3 | 0 | 2/1 | none |
| mixed batch one leftover deep | static_deep_pro | deep_ai | 1 | 10 | deep_parse | gemini-2.5-pro | 1 | 3 | 0 | 2/1 | batch_input, batch_items_3, batch_local_items_2, batch_ai_items_1 |
| mixed batch one leftover deep | fast_then_deep_routing | deep_ai | 2 | 11 | deep_parse | gemini-2.5-pro | 0 | 3 | 0 | 2/1 | fast_unknown_result, fast_below_min_confidence, fast_needs_review |
