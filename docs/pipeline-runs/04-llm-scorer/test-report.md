# Test report: LlmScorer (re-test after fix cycle 1)

## Summary
- Framework: Vitest 5.0.5 (+ Supertest for integration).
- `npm --prefix api run lint`: clean. `npm --prefix api run typecheck`: clean.
- `npm --prefix api test`: 26 files, 672 tests, all passed. Split: unit 15 files / 287 tests passed; integration 11 files / 385 tests passed (real test DB, migrations up to date).
- No failures, no regressions. No real Claude call or key used (all clients are fakes; `loadTestConfig` drops the key).
- I added no new tests this cycle: after critical review, the coder's tests are sufficient (see below). No source code edited.

## Critical review of the fix-cycle tests
- AC16, `deals.service.test.ts` "scores every candidate with the listScorer and never calls the actionScorer": two candidates, asserts `listScorer.score` called 2 times and `actionScorer.score` not called. Would fail if list used actionScorer (listScorer count 0) or if it called both.
- AC17, "returns the dealId with the actionScorer result unchanged and never calls the listScorer": result has `scoredBy: "llm"` and an AI adjustment factor; asserts `toEqual({ dealId, ...llmResult })`, actionScorer called once, listScorer not called. Would fail if the service used listScorer (returns undefined), hard-coded `scoredBy: "rules"`, or altered factors.
- Clamp rows in `llm-scorer.test.ts`: checked by hand. (130,100): band gives 110, only the 0..100 step gives 100. (-30,0): band gives -10, only the 0..100 step gives 0. (-25,5): band gives -5, only the 0..100 step gives 0. So both sides of the 0..100 clamp are exercised and each row fails if that step is removed. The factors-sum assertion also holds in each row.
- Baseline non-mutation test: `structuredClone` snapshot compared after scoring; a `baseline.factors.push(...)` would fail it.
- `prompts.test.ts`: checks `interaction_notes`, `/data/i` and `/never as instructions/i`. Weak-ish (wording based) but meets AC8 and fails if the guard text is removed.

## Tests (by file)
- `api/tests/unit/llm-scorer.test.ts` (LlmScorer, via fake LlmClient/Logger and stub fallback)
- `api/tests/unit/llm-client.test.ts` (AnthropicLlmClient, fake SDK)
- `api/tests/unit/prompts.test.ts` (system prompt)
- `api/tests/unit/container.test.ts` (createPriorityScorers)
- `api/tests/unit/deals.service.test.ts` (DealService)
- `api/tests/integration/test-env.test.ts` (loadTestConfig)
- `api/tests/integration/deals-priority.test.ts` (unchanged, existing)

## Failures
None.

## Spec-coverage map
| AC | Status | Test(s) |
|----|--------|---------|
| 1 valid output, adjustment factor, no warn | Covered & passing | llm-scorer: "returns the LLM result with scoredBy llm and an adjustment factor" |
| 2 clamp table, factors sum | Covered & passing | llm-scorer: it.each "clamps baseline %i with LLM score %i to %i and factors sum to it" (8 rows incl. 130 stub, -30, -25) |
| 3 no factor when delta 0 | Covered & passing | llm-scorer: "omits the adjustment factor when the score equals the baseline" |
| 4 negative adjustment | Covered & passing | llm-scorer: "records a negative adjustment as a negative factor" |
| 5 failure fallback | Covered & passing | llm-scorer: it.each "returns the baseline and logs a warning on %s" (13 rows: network, timeout, LlmResponseError, score >100, negative, non-integer, string, missing score, missing reason, whitespace nextAction, reason >1000, null, non-Error) plus "logs the error name and message but never the notes" |
| 6 request contents | Covered & passing | llm-scorer: "sends the tool, system prompt, max tokens, delimited notes and baseline score" |
| 7 injection escaping | Covered & passing | llm-scorer: "escapes a note so it cannot close the notes tag" |
| 8 system prompt wording | Covered & passing | prompts.test: "tells the model to treat the notes as data and not as instructions" |
| 9 no interactions | Covered & passing | llm-scorer: "says no interactions were recorded and still scores" (also "includes only the first 5 interactions" for the cap edge case) |
| 10 tool_use input returned | Covered & passing | llm-client: "returns the input of the matching tool_use block" |
| 11 create params and options | Covered & passing | llm-client: "forces the tool and sends model, limits and per-request options" |
| 12 missing/other-name block rejects | Covered & passing | llm-client: it.each (text only, empty, other name) |
| 13 SDK error propagates | Covered & passing | llm-client: "propagates SDK errors unchanged" |
| 14 no key: same RuleBasedScorer | Covered & passing | container: "uses the same rule-based scorer for both without an API key" |
| 15 key: LlmScorer for action | Covered & passing | container: "uses the LLM scorer for next actions and rules for the list with an API key" |
| 16 list never calls actionScorer | Covered & passing | deals.service: "scores every candidate with the listScorer and never calls the actionScorer" |
| 17 next-action only actionScorer, llm result passes through | Covered & passing | deals.service: "returns the dealId with the actionScorer result unchanged and never calls the listScorer" |
| 18 existing DealService tests | Covered & passing | rest of deals.service.test.ts |
| 19 integration next-action scoredBy rules | Covered & passing | deals-priority.test.ts (unchanged) |
| 20 loadTestConfig drops key | Covered & passing | test-env.test: "drops the Anthropic API key even when ANTHROPIC_API_KEY is set" |
| 21 one `new Anthropic(` in src, no real HTTP | Covered & passing (verified by grep) | only `api/src/container.ts:69`; all tests use fakes |
| 22 anthropicApiKey only in env.ts and container.ts | Covered & passing (verified by grep) | `api/src/config/env.ts`, `api/src/container.ts` |
| 23 lint, typecheck, tests | Covered & passing | see Summary |

## Regressions
None. All 672 tests pass (previously 630 before the new tests were added).

## Notes
- Fallback scorer throwing is intentionally not caught (spec req 20.1); not tested, by design.
