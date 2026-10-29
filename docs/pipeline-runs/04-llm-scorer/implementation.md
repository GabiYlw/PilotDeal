# Implementation: LlmScorer (Claude) as second PriorityScorer

## Summary
Added `LlmScorer`, a second `PriorityScorer`. It first computes the rule-based result (the baseline), sends Claude the deal, the recent interactions and the baseline through a forced tool call, validates the tool input with zod, clamps the score to baseline +-20 (then 0..100), and returns the combined result with `scoredBy: "llm"`. Any failure logs a warning and returns the baseline unchanged. `DealService` now takes `listScorer` (always rules) and `actionScorer` (LLM when `ANTHROPIC_API_KEY` is set); `container.ts` makes that choice in the exported `createPriorityScorers`.

## Files changed
- `api/package.json`, `api/package-lock.json`: added `@anthropic-ai/sdk` `^1.3.0` (installed 1.3.0).
- `api/src/scoring/priority-scorer.ts`: added `ScoredBy`, `RuleFactorName`, `RuleFactor`, `AI_ADJUSTMENT_FACTOR_NAME`; widened `PriorityFactorName`.
- `api/src/scoring/rule-based-scorer.ts`: uses `RuleFactor`/`RuleFactorName` internally (type-only).
- `api/src/shared/logger.ts` (new): `Logger` (`warn` only) and `ConsoleLogger`.
- `api/src/ai/llm-client.ts` (new): `LlmClient`, `LlmTool`, `LlmToolRequest`, `LlmResponseError`, `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES`, `AnthropicMessagesClient`, `AnthropicLlmClient`.
- `api/src/ai/prompts.ts` (new): `PRIORITY_TOOL`, `PRIORITY_MAX_TOKENS`, `PRIORITY_SYSTEM_PROMPT`, `escapePromptText`, `buildPriorityPrompt`.
- `api/src/ai/.gitkeep`: deleted.
- `api/src/scoring/llm-scorer.ts` (new): `LlmScorer`, `llmPriorityOutputSchema`, `MAX_LLM_ADJUSTMENT`, private `clampScore`, `combine`, `describeError`.
- `api/src/modules/deals/deals.service.ts`: constructor takes `listScorer` and `actionScorer`; list uses the first, next-action the second.
- `api/src/container.ts`: `createPriorityScorers`, `PriorityScorers`, private `createActionScorer`, `ContainerOverrides.logger`, wiring.
- `api/.env.example`: comment update only.
- `api/tests/integration/test-env.ts`: `loadTestConfig` forces `anthropicApiKey: undefined`.
- `api/tests/unit/deals.service.test.ts`: mechanical: `setup()` returns `listScorer` and `actionScorer`; listPrioritized tests use the first, getNextAction tests the second.
- `api/tests/integration/deals-race.test.ts`: mechanical: `unusedScorer` passed twice.

## Deviations from spec
- `AnthropicLlmClient` finds the block with `message.content.find(...)` and narrows with `block?.type !== "tool_use"` instead of a separate helper `findToolInput`. Same behavior, less code, and the SDK's own `ContentBlock` union gives the type narrowing for `input` without a cast.
- Otherwise none. SDK names were checked in the installed `.d.ts` files and match the plan: default export `Anthropic`, `messages.create(params, options?)`, `RequestOptions.timeout` and `maxRetries`, `max_tokens`, `system`, `tools[].input_schema`, `tool_choice: { type: "tool", name }`, `ToolUseBlock { type: "tool_use"; name; input: unknown }`.

## Notes for tester/reviewer
- Lint, typecheck and all API tests pass (21 files, 630 tests). New test files (llm-scorer, llm-client, container, plus the optional test-env check) are for the tester.
- `npx prettier --check` reports style issues in 48 existing files; it is not part of the repo's scripts, so I ignored it.
- `grep anthropicApiKey api/src` matches only `config/env.ts` and `container.ts`; the only `new Anthropic(` is in `container.ts`.
- No real API call was made. Constructing the SDK client does no network I/O. `loadTestConfig` drops the key, so integration tests always get the rule-based action scorer.
- Test `createPriorityScorers` directly (it is pure); `createContainer` would build a Prisma client.

### Decisions explained (plain English)
- **New dependency `@anthropic-ai/sdk` 1.3.0:** the official Claude SDK, required by CLAUDE.md. It gives typed tool use, built-in per-request timeout and retry, and typed API errors, so we do not hand-roll HTTP, backoff or response types. It is the only new dependency.
- **Forced tool use for structured output:** with `tool_choice: { type: "tool", name }` Claude must answer by calling our tool, whose JSON Schema describes `{ score, reason, nextAction }`. That is more reliable than asking for JSON in free text. We still validate with zod, because the schema is a hint to the model, not a guarantee.
- **Clamp as guardrail:** the score may move at most 20 points from the rule-based baseline, then is held to 0..100. A hallucinated or prompt-injected score therefore cannot swing priority much. The adjustment is added as a factor so factors always sum to the score.
- **Fallback on any failure:** network errors, timeouts, HTTP errors, a missing tool block and zod failures are all caught in `LlmScorer`, logged as a warning (deal id and error name/message only, never notes, prompt or key) and answered with the baseline (`scoredBy: "rules"`). The baseline is computed outside the try block, since a failing rule scorer is a bug, not an LLM failure.
- **Prompt injection defense:** interaction notes, deal title, company name and baseline text are HTML-escaped (`&` first, then `<`, `>`) so customer text can never open or close a tag, and they sit inside `<interaction_notes>`. The system prompt says that content is untrusted data, never instructions.
- **Two scorers (list vs action):** the list endpoint scores every open deal, so using the LLM there would mean one slow, paid API call per deal. Only `next-action` (one deal per request) uses the LLM. This is Strategy pattern wiring done once in `container.ts`, with the only API key check.
- **SDK client injected:** `AnthropicLlmClient` receives a `Pick<Anthropic, "messages">`, built in the container. Tests pass a tiny fake with `messages.create`, with no module mocking or network. Timeout and retries are per-request options so tests can assert them (`maxRetries: 1` means at most 2 attempts).
- **`LlmClient` returns `unknown`:** zod validation stays in `LlmScorer` because the schema belongs to that scorer; the client stays reusable for later tools (such as /ask).
- **`loadTestConfig` drops the key:** a developer's real key in `.env` or the shell must never cause real Claude calls from tests.
- **Suggested commit:** `feat: add LLM-based priority scorer for next actions`

## Fix cycle 1

Only tests changed; no source code was touched. Lint, typecheck and all API tests pass (26 files, 672 tests). No real Claude call or key was used.

- **High, AC16/AC17 (`api/tests/unit/deals.service.test.ts`):**
  - New `listPrioritized` test: two candidates are scored by `listScorer` (called twice) and `actionScorer.score` is never called.
  - The `getNextAction` success test now uses a `scoredBy: "llm"` result with an "AI adjustment from interaction notes" factor. It asserts the response equals `{ dealId, ...result }`, that `actionScorer.score` was called once and that `listScorer.score` was never called. A service that hard-coded `scoredBy: "rules"` or used the wrong scorer now fails.
  - The corrected coverage map in `.pipeline/test-report.md` belongs to the tester, so I did not edit it.
- **Low, clamp table (`llm-scorer.test.ts`):**
  - The 0 and 100 rows did not hit a clamp. The +-20 band is applied first, and an LLM score is already 0..100, so the lower 0 clamp can only bind when the baseline is below -20. A baseline of -10 with LLM 0 would still not bind, because the band gives 0 already.
  - Added rows (-30, 0, 0) and (-25, 5, 0). The band yields -10 and -5 respectively, and only the 0..100 step brings them to 0.
  - The existing (130, 100, 100) row binds the upper side: the band lifts to 110 and the 0..100 step lowers it to 100. Each of these rows fails if the 0..100 step is removed.
- **Low, baseline mutation:** new test snapshots `structuredClone(baseline)` and asserts it is unchanged after a successful score, so `baseline.factors.push(...)` would fail it.
- **Low, system-prompt wording test:** moved to the new `api/tests/unit/prompts.test.ts` (one unit file per module, as elsewhere in `tests/unit`).
- **Low, fallback scorer throwing:** kept on purpose (spec req 20.1, open question 13). `RuleBasedScorer` is pure, so a failure there is a bug, not an LLM failure, and should surface rather than be hidden.
- **Low/note, ~30 s degraded-API latency:** kept as specified (`timeout: 15000`, `maxRetries: 1` means up to 2 attempts). It affects only `GET /deals/:id/next-action`, which then falls back to the rule-based result. The list endpoint never calls the LLM.
