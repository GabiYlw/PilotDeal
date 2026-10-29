> **Note:** After this run, LlmScorer was changed to receive the Clock (today's UTC date in the prompt) and to skip the LLM call when a deal has no interactions, in the same commit.

# Review: LLM-based priority scorer (LlmScorer via Claude), re-review after fix cycle 1

## Summary
Fix cycle 1 changed tests only, and it resolves the blocking High finding. `deals.service.test.ts` now checks that `listPrioritized` scores every candidate with `listScorer` and never calls `actionScorer`. It also checks that `getNextAction` passes a `scoredBy: "llm"` result, including an AI adjustment factor, through unchanged as `{ dealId, ...result }`, calls `actionScorer` once and never calls `listScorer`. So AC16 and AC17 are now tested, and each assertion fails if the behavior breaks. The Low findings were fixed or deliberately kept with a justification. I re-read the full diff and every new file. The production code has not changed since the last review and has no regressions. It is correct, secure (escaping, delimiting tags, system-prompt guard, ±20 clamp, logs hold only the deal id and error text), and follows CLAUDE.md (layering, constructor injection, the key checked only in `container.ts`, prompts only in `prompts.ts`, no `any`, `import type`). The tester reports 672 of 672 tests passing, with lint and typecheck clean. Only one documentation nit remains.

## Previous findings: status
- **High, AC16/AC17 not tested:** resolved. See `api/tests/unit/deals.service.test.ts:406-415` and `:468-486`. The coverage map in `.pipeline/test-report.md` now points to these tests.
- **Low, the 0..100 clamp rows never bound:** resolved. See `api/tests/unit/llm-scorer.test.ts:99-101`. Rows (130, 100, 100), (-30, 0, 0) and (-25, 5, 0) each depend on the 0..100 step, which I checked by hand: the band gives 110, -10 and -5. Correction to my previous review: the row I suggested, (-10, 0, 0), would not have bound, because the band already gives 0. The coder rightly picked other rows.
- **Low, baseline mutation not guarded:** resolved. See `api/tests/unit/llm-scorer.test.ts:113-121` (`structuredClone` snapshot).
- **Low, placement of the system-prompt test:** resolved. It moved to `api/tests/unit/prompts.test.ts`.
- **Low, the fallback scorer can throw:** kept on purpose, with a justification in implementation.md (spec req 20.1, open question 13). I accept that.
- **Latency note:** kept as specified, with a justification in implementation.md. I accept that.

## Findings

### Critical
None.

### High
None.

### Medium
None.

### Low
- **`.pipeline/implementation.md:55`:** this line says rows (-30, 0) and (-25, 5) give band values of "-10 and 0 respectively". For (-25, 5) the band gives -5, not 0: min(-25 + 20, max(-25 - 20, 5)) = -5. If the band gave 0, that row would not exercise the 0..100 step. The test itself is correct, and `.pipeline/test-report.md:13` states it correctly. **Fix (optional, docs only):** change "-10 and 0 respectively" to "-10 and -5 respectively".

## Spec adherence
| AC | Status |
|----|--------|
| 1 valid output, adjustment factor, no warn | Met (`llm-scorer.test.ts:66`) |
| 2 clamp table, factors sum | Met (`llm-scorer.test.ts:93`, 8 rows, including both sides of the 0..100 clamp) |
| 3 no factor when delta is 0 | Met (`llm-scorer.test.ts:123`) |
| 4 negative adjustment | Met (`llm-scorer.test.ts:134`) |
| 5 failure fallback table | Met (`llm-scorer.test.ts:169`, 13 rows) |
| 6 request contents | Met (`llm-scorer.test.ts:194`) |
| 7 injection escaping, single closing tag, `&amp;` | Met (`llm-scorer.test.ts:217`) |
| 8 system prompt wording | Met (`prompts.test.ts:5`) |
| 9 no interactions | Met (`llm-scorer.test.ts:233`), plus the 5-interaction cap (`:245`) |
| 10-13 AnthropicLlmClient | Met (`llm-client.test.ts`) |
| 14-15 container | Met (`container.test.ts`) |
| 16 listPrioritized never calls actionScorer | Met (`deals.service.test.ts:406`) |
| 17 getNextAction uses only actionScorer, `scoredBy: "llm"` passes through | Met (`deals.service.test.ts:468`) |
| 18 existing DealService tests pass | Met |
| 19 integration next-action without a key | Met (`deals-priority.test.ts` unchanged, `loadTestConfig` drops the key) |
| 20 loadTestConfig drops the key | Met (`test-env.test.ts:9`) |
| 21 one `new Anthropic(` in src, no real HTTP | Met (`container.ts` only, all tests use fakes) |
| 22 `anthropicApiKey` only in env.ts and container.ts | Met (from the diff: `container.ts:79,82`) |
| 23 lint, typecheck, tests | Met per the test report (26 files, 672 tests passing) |

Other checks:
- The `@anthropic-ai/sdk` 1.3.0 dependency is justified in implementation.md, and it is the only new dependency.
- The `.env.example` comment was updated and `api/src/ai/.gitkeep` was deleted.
- The documented deviation (inline `find` with narrowing instead of a `findToolInput` helper) behaves the same.

## Verdict
All earlier blocking findings are resolved, all acceptance criteria are met and tested, and there are no test failures. The source code is correct, secure and convention-clean. The only remaining item is an optional Low documentation nit.

STATUS: PASS
