### Summary
Vitest 5 + React Testing Library (web) and Vitest + Supertest (API). No failures.

| Command | Result |
|---|---|
| `npm --prefix web run lint` | pass |
| `npm --prefix web run typecheck` | pass |
| `npm --prefix web run test` | 64 files, 572 tests, all pass |
| `npm --prefix web run build` | pass; `/ask` is a Partial Prerender route |
| `npm --prefix api run lint` / `typecheck` | pass |
| `npm --prefix api test` | 42 files, 911 tests, all pass (test DB, no pending migrations) |

### Tests added (by the tester, on top of the coder's tests)
- `web/tests/unit/ask-form.test.tsx`: form action is `/ask`, input named `q`, no `dealId` field when unscoped; no `required`/`minlength`/`maxlength` on the input (spec edge case: API is the only validator).
- `web/tests/unit/ask-static-rules.test.ts` (`it.each` per file): AC25, no `dangerouslySetInnerHTML`, hex/rgb/hsl or palette colors in the files added for the ask page.
- `web/tests/unit/answer-text.test.tsx` (appended): repeated label `[S1] ... [S1]` links each occurrence; a known label that is not cited is still a link; line breaks and unicode kept with `whitespace-pre-line`.

Coder tests reviewed and judged adequate: `citations`, `ask-display`, `ask`, `answer-text`, `source-card`, `ask-answer`, `ask-results`, `ask-view`, `ask-skeleton`, `ask-page`, `relevance-indicator` (incl. `Card.highlighted`), plus extensions of `api`, `load`, `deal-view`. All required cases are present: markers `[S1]`, `[S1, S2]`, unknown labels, `<script>`/`<b>` as text, cited highlighting, the three answer states, empty sources, example questions, deal scope (404, 400 invalid id, unreachable, empty dealId, repeated params), field errors with aria attributes, the 503 message.

### Failures
None.

### Spec-coverage map
| AC | Status | Tests |
|---|---|---|
| 1 metadata noindex + title | Covered & passing | `ask-page.test.tsx` |
| 2 heading | Covered & passing | `ask-page.test.tsx` |
| 3 form, textbox, button, 3 example links, no askCrm | Covered & passing | `ask-view.test.tsx`, `ask-form.test.tsx` |
| 4 scoped examples, hidden input | Covered & passing | `ask-view.test.tsx`, `ask-results.test.tsx` |
| 5 scope notice, clear link, askCrm with dealId | Covered & passing | `ask-view.test.tsx`, `ask-results.test.tsx` |
| 6 invalid/missing deal (404, 400), no notFound | Covered & passing | `ask-view.test.tsx` (`it.each`) |
| 7 getDeal unreachable | Covered & passing | `ask-view.test.tsx` |
| 8 `{question}` without dealId key; POST /ask body | Covered & passing | `ask-results.test.tsx`, `api.test.ts` |
| 9 parseCitations / links / text preserved | Covered & passing | `citations.test.ts`, `answer-text.test.tsx` |
| 10 unknown and mixed labels | Covered & passing | `citations.test.ts`, `answer-text.test.tsx` |
| 11 HTML rendered as text | Covered & passing | `answer-text.test.tsx` |
| 12 Cited badge, border-accent / border-border | Covered & passing | `source-card.test.tsx`, `ask-answer.test.tsx`, `relevance-indicator.test.tsx` |
| 13 source card contents, id | Covered & passing | `source-card.test.tsx` |
| 14 relevance bands, meter, no "%" | Covered & passing | `source-card.test.tsx`, `ask-display.test.ts`, `relevance-indicator.test.tsx` |
| 15 normal answer, no notices | Covered & passing | `ask-answer.test.tsx` |
| 16 insufficient notice order | Covered & passing | `ask-answer.test.tsx` |
| 17 answeredBy none | Covered & passing | `ask-answer.test.tsx` |
| 18 empty sources | Covered & passing | `ask-answer.test.tsx` |
| 19 field error + aria | Covered & passing | `ask-results.test.tsx` (+ leftovers as alert) |
| 20 503 EMBEDDING_UNAVAILABLE | Covered & passing | `ask-results.test.tsx`, `ask.test.ts` |
| 21 404 on search | Covered & passing | `ask-results.test.tsx`, `ask.test.ts` |
| 22 unreachable; 500 / other 503 rethrown | Covered & passing | `ask-results.test.tsx`, `ask.test.ts` |
| 23 AskPending | Covered & passing | `ask-skeleton.test.tsx` |
| 24 DealView link | Covered & passing | `deal-view.test.tsx` |
| 25 no dangerouslySetInnerHTML / raw colors | Covered & passing | `ask-static-rules.test.ts`; coder also reported the only hit in `web/src` is the old theme script |
| 26 lint, typecheck, test, build, API checks | Passing | see Summary |

### Gaps (not covered by automated tests; no failures)
- The keyed `Suspense` fallback in `AskView` (the fallback re-appearing on a new `q`) is not unit-tested. Async children cannot be rendered by RTL and `AskView` tests mock `AskResults`. Only `AskPending` is tested in isolation. Needs a browser/E2E check.
- `app/ask/loading.tsx` and `app/ask/error.tsx` have no tests (the companies equivalents are not tested either). Build compiles them.
- `next/form` is mocked as a plain `<form>`, so the real client navigation to `/ask?q=...` is not exercised.
- Minor duplication: the relevance banding table appears in `ask-display.test.ts`, `source-card.test.tsx` and partly `relevance-indicator.test.tsx`. The `source-card` copy could be trimmed to one representative case (CLAUDE.md: no duplicate coverage). Left as is since it also checks the "%" rule per level.

### Regressions
None. All 572 web tests and 911 API tests pass. No source code was modified, and no git commands that change state were run.
