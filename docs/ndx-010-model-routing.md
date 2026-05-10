# NDX-010 parser model routing

## Policy

The parser has three gates, in order:

1. **Local parser/batch coordinator**: deterministic finance, todo, shopping, note, event, journal, query-only, and per-item batch routing. This sends no AI call.
2. **Fast extraction model**: when `appSettings.parserModelRouting.enabled === true`, ambiguous leftovers first use the allowlisted fast extraction model (`gemini-2.5-flash` by default) through the legacy structured extractor.
3. **Deep parse model**: only used when the fast extraction output is ambiguous or incomplete. The allowlisted default is `gemini-2.5-pro` through the native two-stage parser.

The feature flag defaults off, so existing `useProParser` / `parsingModel` behavior is preserved until the owner explicitly enables model routing. This avoids a silent downgrade for users who intentionally selected the pro parser.

## Supported model IDs

`services/parserModelRouting.ts` is the model allowlist. NDX-010 intentionally introduces no OpenClaw model alias and does not add `openai-codex/gpt-5.5` to app parser runtime. That preference remains an agent/Mission Control execution policy, not a browser app parser model.

Allowed parser runtime IDs:

- `gemini-2.5-flash` (`fast_extraction`)
- `gemini-2.5-pro` (`deep_parse`)

Unsupported configured IDs are ignored with `unsupported_*_model_ignored:*` warnings in routing metadata and are never passed into provider calls by the new routing path.

## Feature flag/config seam

```ts
appSettings.parserModelRouting = {
  enabled: true,
  fastModel: 'gemini-2.5-flash',
  deepModel: 'gemini-2.5-pro',
  minFastConfidence: 'medium',
  escalateOnNeedsReview: true,
}
```

Defaults in code:

- `enabled: false`
- `fastModel: DEFAULT_FLASH_MODEL` (`gemini-2.5-flash`)
- `deepModel: DEFAULT_PRO_MODEL` (`gemini-2.5-pro`)
- `minFastConfidence: 'medium'`
- `escalateOnNeedsReview: true`

## Deep-parse escalation criteria

Fast extraction escalates to deep parse when any of these are true:

- fast result is empty
- fast result action/entity is `unknown`
- fast confidence is below `minFastConfidence`
- fast result needs review and `escalateOnNeedsReview !== false`
- fast result carries the missing-API-key marker
- batch fast extraction returns fewer results than candidate leftovers
- batch fast extraction over-expands beyond 2x candidate count
- fast extraction throws

## Owner visibility

When enabled, `ParserRouterDecisionMetadata.modelRouting` and `ParserBatchMetadata.modelRouting` record:

- policy
- fast/deep model IDs
- selected tier and final model
- fast/deep attempted booleans
- AI call count
- escalation reason codes
- ignored unsupported-model warnings

Review Center now renders a concise model-routing line for successful parser tasks so the owner can see whether fast extraction or deep parse was used.

## Cost/speed tradeoff

- Clear local items: 0 AI calls, fastest path.
- Ambiguous item accepted by fast extraction: 1 Flash call instead of 1 Pro/two-stage deep parse.
- Ambiguous item rejected by fast extraction: 2 calls (Flash then Pro), slower than direct Pro but bounded to hard cases and produces explicit escalation telemetry.
- Mixed batches: clear items remain local; only ambiguous leftovers enter model routing.

## Rollback

1. Set `appSettings.parserModelRouting.enabled` to `false` or remove the object.
2. Existing static behavior resumes: `useProParser` uses `parsePro`; otherwise legacy `classifyText` uses `parsingModel || DEFAULT_FLASH_MODEL`.
3. If shipped and a code rollback is required, revert the NDX-010 commit. No data migration is required; unknown app settings are harmless in older code paths.

## Risk notes

- Provider availability: both fast and deep tiers still require the existing Gemini key. Missing keys escalate to deep parse and then return the existing reviewable missing-key failure.
- Model aliases: new routing only allows the two existing Gemini constants; unsupported aliases are logged as metadata warnings and ignored.
- Silent downgrade: disabled by default. Enabling the feature is the explicit owner approval to try Flash first before Pro.
- Fallback quality: fast extraction must pass confidence/result-shape gates; otherwise the deep parser remains the source of truth.
