### Summary
`POST /ask` now returns a short Claude-written answer when an Anthropic key is configured. The answer is grounded in the retrieved interactions, which are labelled S1..Sn and cited inline. The answer step is a Strategy: `AnswerGenerator` has two implementations, `LlmAnswerGenerator` and `NoAnswerGenerator`, and `container.ts` picks one. Any LLM failure falls back to the old "sources only" response. A failure never makes the request fail.

### Files changed
- `api/src/ai/answer-generator.ts` (new): `AnswerGenerator` interface, `AnswerSource`, `AnswerDraft`, `GeneratedAnswer` and `NoAnswerGenerator`.
- `api/src/ai/llm-answer-generator.ts` (new): `LlmAnswerGenerator` and the zod `llmAnswerOutputSchema`. It mirrors `LlmScorer`.
- `api/src/ai/prompts.ts`: added `ANSWER_TOOL`, `ANSWER_MAX_TOKENS`, `ANSWER_MAX_LENGTH`, `ANSWER_SYSTEM_PROMPT` and `buildAnswerPrompt`. The priority prompt is untouched.
- `api/src/modules/ask/ask.schemas.ts`: `AnsweredBy` is now `"llm" | "none"`, `AskSource.label` is new, and `AskResponse` has the new fields.
- `api/src/modules/ask/ask.service.ts`: takes an `AnswerGenerator`, labels the sources, maps citations, checks grounding, and handles the fallback.
- `api/src/container.ts`: added `createLlmClient` and `createAnswerGenerator`. `createPriorityScorers` now takes an `LlmClient | undefined`. Added the `llmClient` override.
- `api/tests/support/fake-llm-client.ts` (new): a fake `LlmClient` that records requests.
- `api/tests/unit/llm-answer-generator.test.ts` (new): generator success, the failure table, prompt and escaping tests, and `NoAnswerGenerator`.
- `api/tests/integration/ask-answer.test.ts` (new): the full HTTP flow with the fake client.
- `api/tests/unit/ask.service.test.ts`, `container.test.ts`, `prompts.test.ts`, `api/tests/integration/ask.test.ts`, `http.ts`: updated for the new constructor and signatures, plus new tests.

### Deviations from spec
None. `ANSWER_MAX_LENGTH` lives in `prompts.ts`, one of the two options the spec allowed. The unit test uses a `TimeoutError`-named error for the timeout case.

### Notes for tester/reviewer
- Lint, typecheck and the full `npm test` pass: 41 files and 878 tests, unit and integration. The test database was available.
- No new dependencies, env vars or migrations.
- Citation rules, in plain English:
  - The model returns label strings.
  - The service maps them to interaction ids by filtering the labelled rows against a set of the trimmed labels.
  - That one step drops unknown labels, removes duplicates and keeps source order.
  - A non-"insufficient" answer with zero valid citations is treated as ungrounded. It is replaced by the sources-only response, with one warning.
- Logging: each failure produces exactly one warning. The generator logs its own failures and returns `null`, so the service stays silent on `null`. The service only warns for an ungrounded answer or an unexpected rejection. The question and the notes are never logged.
- The `llmClient` override reaches both the answer generator and `LlmScorer`. `createLlmClient` is the only place that checks the API key.
- Line endings are LF. No CRLF files were found under `api/src` or `api/tests`.
- Suggested commit message: `feat: generate cited answers for /ask with Claude`
