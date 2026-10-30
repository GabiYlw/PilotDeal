### Summary
Vitest + Supertest. Lint, typecheck and the full suite pass: 41 files, 878 tests (unit + integration against dealpilot_test), 0 failures. No tests were added by the tester: the coder's tests already cover every acceptance criterion (see map), so extra tests would only duplicate coverage.

Commands run (from repo root):
- `npm --prefix api run lint` : clean
- `npm --prefix api run typecheck` : clean
- `npm --prefix api test` : 41 passed (41), 878 passed (878)
- CRLF scan of api/src and api/tests: no CRLF files found

### Tests added
None by the tester. Reviewed existing new/updated tests (all use fakes; no Anthropic calls, no model downloads):
- tests/unit/llm-answer-generator.test.ts, tests/unit/ask.service.test.ts, tests/unit/container.test.ts, tests/unit/prompts.test.ts
- tests/integration/ask-answer.test.ts, tests/integration/ask.test.ts, tests/integration/http.ts, tests/support/fake-llm-client.ts

### Failures
None.

### Spec-coverage map
| AC | Tests | Status |
|----|-------|--------|
| 1 no key, labels, new fields | integration/ask.test.ts (first test, key list + toEqual with label S1); unit ask.service "returns answer null, answeredBy none..." | Covered & passing |
| 2 no matches, no LLM call | unit ask.service "does not call the generator when no sources are found"; integration ask-answer "does not call the LLM when no interactions match" | Covered & passing |
| 3 fake client grounded answer | integration ask-answer "returns the generated answer..."; unit ask.service "returns the llm answer with the cited interaction ids" | Covered & passing |
| 4 citation mapping/dedupe/order | unit ask.service citation it.each table | Covered & passing |
| 5 ungrounded fallback + one warning | unit ask.service it.each over [] and ["S9"] | Covered & passing |
| 6 insufficientInformation true | unit ask.service insufficient tests (with/without citations, no warning) | Covered & passing |
| 7 generator failure table | unit llm-answer-generator it.each (15 cases), "logs the error as Name: message", secret question/note not logged | Covered & passing |
| 8 2000 chars, trim, extra keys, citedLabels | unit llm-answer-generator success + 2000-char tests | Covered & passing |
| 9 service on reject / null | unit ask.service reject (one warning, no question) and null (no warning) tests; integration ask-answer LLM failure (200, one warning) | Covered & passing |
| 10 none responses have insufficient false, ids [] | fallback assertions in ask.service and integration tests | Covered & passing |
| 11 callTool request shape, date at day boundaries | unit llm-answer-generator tool/system/maxTokens test; prompt order/blocks test; UTC start/end it.each | Covered & passing |
| 12 escaping, single closing tags | unit llm-answer-generator escaping test | Covered & passing |
| 13 ANSWER_SYSTEM_PROMPT content | unit prompts.test.ts it.each (8 patterns) | Covered & passing |
| 14 container factories | unit container.test.ts (createLlmClient, createAnswerGenerator, createPriorityScorers) | Covered & passing |
| 15 NoAnswerGenerator null | unit llm-answer-generator.test.ts "NoAnswerGenerator" | Covered & passing |
| 16 no notes in sources, existing behaviours | integration ask-answer (no notes key), existing ask.test.ts and ask.service tests (ordering, threshold, limit, deal filter, 404, 503, 400) | Covered & passing |
| 17 lint/typecheck/test pass, no network | commands above | Covered & passing |

Minor note: unit tests assert the prompt-level properties via `callTool` mock; the generator's no-short-circuit on empty sources is intentionally untested (the rule lives in AskService, covered by AC 2).

### Regressions
None. All previously existing tests pass.
