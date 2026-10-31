### Summary
Built the `/ask` page of the web dashboard. A `next/form` GET form puts the question in the URL (`?q=`, optional `?dealId=`). The server calls `POST /ask` and renders the cited answer, state notices and source cards. Citation markers such as `[S1]` and `[S1, S2]` become links to the source cards. The deal page got an "Ask about this deal" link. The API was not touched.

### Files changed
Modified:
- `web/src/lib/types.ts`: `AnsweredBy`, `AskSource`, `AskResponse`, `AskBody`.
- `web/src/lib/api.ts`: `askCrm` (POST /ask) and the `EMBEDDING_UNAVAILABLE` constant.
- `web/src/lib/messages.ts`: four new ask messages.
- `web/src/lib/form-state.ts`: `AskField`.
- `web/src/lib/load.ts`: `loadOptionalResource` (missing becomes a result, no `notFound()`).
- `web/src/lib/browser-validation.ts`: `errorProps` moved out, re-exported for existing callers.
- `web/src/components/ui/card.tsx`: `highlighted` prop.
- `web/src/components/deals/deal-view.tsx`: "Ask about this deal" link.
- `web/src/app/not-found.tsx`: comment only.
- Tests extended: `web/tests/unit/api.test.ts`, `load.test.ts`, `deal-view.test.tsx`.

Created:
- `web/src/lib/ask-display.ts`, `citations.ts`, `ask.ts` (server-only), `error-props.ts`.
- `web/src/components/ui/relevance-indicator.tsx`.
- `web/src/components/ask/`: `ask-form`, `deal-scope-notice`, `example-questions`, `answer-text`, `answer-card`, `source-card`, `source-list`, `ask-answer`, `ask-results`, `ask-view`, `ask-skeleton` (`.tsx`).
- `web/src/app/ask/page.tsx`, `loading.tsx`, `error.tsx`.
- New tests in `web/tests/unit/`: `citations.test.ts`, `ask-display.test.ts`, `ask.test.ts`, `answer-text.test.tsx`, `source-card.test.tsx`, `ask-answer.test.tsx`, `ask-results.test.tsx`, `ask-view.test.tsx`, `ask-skeleton.test.tsx`, `ask-page.test.tsx`, `relevance-indicator.test.tsx` (also covers `Card.highlighted`), plus the shared fixture file `ask-fixtures.ts`.

### Deviations from spec
- `errorProps` now lives in the new `web/src/lib/error-props.ts` and `browser-validation.ts` re-exports it. The spec said to use it from `browser-validation.ts`, but that file imports `useState`, and Turbopack rejects importing it into a Server Component (`AskForm` is rendered on the server). Existing client callers keep working through the re-export.
- Tests mock `next/form` (a plain `<form>`) because it needs the app router, which does not exist in unit tests. `ask-view.test.tsx` stubs its results as `results for [question] in dealId`. The brackets keep an empty question visible, since Testing Library collapses whitespace.
- Added `tests/unit/ask-fixtures.ts` as a shared fixture builder. Nothing else differs from the plan.

### Notes for tester/reviewer
- Layers: all data access goes through `lib/api.ts` (`askCrm`, `getDeal`). `lib/ask.ts` maps `ApiError`s to page states (`AskOutcome`) so the component stays a plain `switch`. The web only reads API flags (`insufficientInformation`, `citedInteractionIds`) and does no rule-making. The 0.6 and 0.4 relevance bands are display formatting only.
- Loading state: `next/form` with a string action calls `router.push`, so `useFormStatus` never reports pending. The result area is therefore wrapped in a `Suspense` whose `key` is the URL, so every new question shows the `AskPending` fallback (disabled form plus skeleton). Re-submitting the identical URL keeps the old results; this is accepted in the spec.
- Model output is untrusted. It is rendered only as React text nodes and links we build (no `dangerouslySetInnerHTML`; the only one in `web/src` is the pre-existing theme script in `layout.tsx`). `parseCitations` keeps brackets and commas as text, so joined segments equal the original answer.
- Behavior of `AskView`: an invalid or deleted scope deal shows only the notice with "Clear scope" (no form, no search, no 404). `q=""` is sent to the API so its validation message shows next to the field.
- No new dependencies. Suggested commit: `feat: add Ask your CRM page with cited answers and deal scope`.

Command results (run from `web/`):
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run test`: 62 files, 551 tests, all pass.
- `npm run build`: pass; `/ask` is listed as a Partial Prerender route.
- API lint, typecheck and tests were not run: nothing under `api/` changed.
