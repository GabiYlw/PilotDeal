> **Note:** Low findings 1 and 2 were fixed after this pipeline run, in the same commit.

### Summary
The change adds LLM answer generation to `POST /ask` as a Strategy (`AnswerGenerator` with `LlmAnswerGenerator` / `NoAnswerGenerator`), and the implementation matches the spec closely. Layering is respected: the service depends only on the interface, the key check and implementation choice live only in `container.ts` (`createLlmClient`, `createAnswerGenerator`, `createActionScorer`), and prompts and the tool definition are in `src/ai/prompts.ts`. The LLM output is validated with a non-strict zod schema. Every piece of untrusted text (question, notes, deal title, company name) goes through `escapePromptText` inside `<question>` / `<interaction_notes>` tags. The generator never rejects, and the service also catches rejections as a second line of defence, so a failure never breaks the request. Every `answeredBy: "none"` path goes through `sourcesOnly`, so the invariants hold by construction. The tester reports lint, typecheck and all 878 tests passing, with no failures and every AC covered. I found no blocking issues, only small gaps in test strength.

### Findings

**Critical**
None

**High**
None

**Medium**
None

**Low**
- `api/tests/integration/ask-answer.test.ts:84`: `expect(fakeLlm.requests[0]?.prompt).toContain("price")` is weak. The notes ("price", "price budget") also contain "price", so this assertion still passes if the question is dropped from the prompt. Fix: assert `toContain("<question>\nprice\n</question>")`, or use a distinct question word that does not appear in the notes.
- `api/tests/unit/llm-answer-generator.test.ts:158-170`: the escaping test covers the question and the notes but not the deal title or company name. If `escapePromptText` were removed from `api/src/ai/prompts.ts:61-62`, no test would fail. AC 12 only requires question and notes, so this does not block. Fix: add an injection string to `dealTitle` and `companyName` in the same test and assert that it appears escaped.
- `api/tests/unit/llm-answer-generator.test.ts:100-103`: the failure table only checks `sourceCount` with `objectContaining`. The `"Name: message"` error text is checked once, for `LlmResponseError` (line 109). That matches the spec's test plan and is acceptable. A non-Error rejection (`"boom"`) is not checked for how `describeError` formats it, but `describeError` is existing shared code.

### Spec adherence
- AC 1: Met. `sourcesOnly` is used when there is no key, `label` is set, and the 9-key list is in `ask.test.ts`.
- AC 2: Met. There is an early return on zero rows (`ask.service.ts`), checked by a unit test and by the integration test (`fakeLlm.requests` is empty).
- AC 3: Met. Covered by the integration test with `FakeLlmClient` and by a unit test.
- AC 4: Met. `mapCitations` uses Set-of-trimmed-labels filtering, so labels are deduped, unknown ones are dropped and source order is kept. Covered by a table-driven test.
- AC 5: Met. The ungrounded warning is logged once, with `{ sourceCount, citedLabelCount }`.
- AC 6: Met. With insufficient information, answeredBy is "llm", valid ids are kept and no warning is logged.
- AC 7: Met. The failure table has 15 cases, each with one warning and no question or notes in the log.
- AC 8: Met. Trimming, stripping of extra keys, 2000-char acceptance and `citedLabels` are all handled.
- AC 9: Met. On rejection the service warns once and falls back. On null it falls back with no warning.
- AC 10: Met. All "none" responses go through `sourcesOnly`.
- AC 11: Met. The tool name, system prompt, maxTokens, UTC date at both day boundaries, label order and tag contents are all covered.
- AC 12: Met. Escaping is in place and each closing tag appears exactly once.
- AC 13: Met. `ANSWER_SYSTEM_PROMPT` assertions are table-driven.
- AC 14: Met. The container factory tests cover this, and `createLlmClient` is the only place that checks the key.
- AC 15: Met.
- AC 16: Met. No `notes` key appears in the sources, and the existing `/ask` tests are updated and pass.
- AC 17: Met, per the test report (lint, typecheck and 878 tests pass). Tests use `FakeLlmClient` or `vi.fn()`, and integration config drops the key.

No new dependencies, env vars or migrations. ESM `.js` imports, `import type`, `catch (error: unknown)` and no `any` follow the conventions.

### Verdict
The change is correct, complete and secure, and follows CLAUDE.md. The only findings are Low-severity ways to make the tests stronger, and none of them is a bug or a spec violation.

STATUS: PASS
