# NDX-001 parser baseline benchmark

Generated: 2026-05-10T05:25:22.339Z
Gemini key present: false

## Methodology

- Sample count: one run per benchmark case in this Node/tsx runtime.
- Cold/warm timing: no warm-up separation; first local row may include module/JIT/cache setup.
- Real vs estimated: local router/canonicalizer/guard latency is measured live; deep Gemini provider latency is not measured when no key is configured.
- Non-SLA estimates: deep-AI latency/tokens are planning estimates only; queue live-provider calibration in a Gemini-keyed environment before treating them as SLA.
- Token estimates: static `ceil(promptCharacters / 4)` from current repo prompt text; not provider billing truth.
- Current behavior proof: `hooks/useBrainDumpData.ts` calls `routeParserInput` before legacy/pro deep parser fallback, so `local_save` rows are current behavior, not hypothetical future leakage.

| Case | Parser mode | Status | Route | Intent | Confidence | Latency ms | AI calls | Avoided AI calls | Max retry calls | Est input tokens | Est output tokens | Results | Review results | Duplicate guard removed | Reason codes |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| simple expense | router-current-default | ok | local_save | finance | 0.88 | 26 | 0 | 1 | 0 | 0 | 248 | 1 | 0 | 0 | obvious_spend_phrase_with_amount |
| transfer | router-current-default | ok | local_save | finance | 0.95 | 4 | 0 | 1 | 0 | 0 | 71 | 1 | 0 | 0 | local_finance_fast_path, local_finance_transfer |
| saving | router-current-default | ok | local_save | finance | 0.95 | 1 | 0 | 1 | 0 | 0 | 95 | 1 | 0 | 0 | local_finance_fast_path, local_finance_saving |
| todo | router-current-default | ok | local_save | todo | 0.9 | 1 | 0 | 1 | 0 | 0 | 78 | 1 | 0 | 0 | explicit_todo_prefix |
| shopping | router-current-default | ok | local_save | shopping | 0.9 | 3 | 0 | 1 | 0 | 0 | 73 | 1 | 0 | 0 | obvious_shopping_intent |
| mixed batch | router-current-default | deep_ai_missing_key | deep_ai | mixed | 0.45 | 5 | 1 | 0 | 9 | 2262 | 90 | 1 | 0 | 0 | mixed_or_complex_input |
| long natural language | router-current-default | deep_ai_missing_key | deep_ai | mixed | 0.45 | 0 | 1 | 0 | 9 | 2284 | 134 | 1 | 0 | 0 | mixed_or_complex_input |
