# Review: "Ask your CRM" page (web)

> **Note:** The four Low findings below were fixed after this pipeline run, in the same commit.
> - **Duplicated tables:** `source-card.test.tsx` now keeps one relevance case and `ask-results.test.tsx` one rethrow case. The full tables stay in `ask-display.test.ts` and `ask.test.ts`.
> - **Heading order:** `CardTitle` takes an optional `level` (2 or 3, default 3). "Answer" and "Try asking" are now `h2`, like "Sources", so no level is skipped under the page `h1`. Tests assert both levels.
> - **Palette guard:** `ask-static-rules.test.ts` now checks every Tailwind color utility (`ring`, `fill`, `stroke`, `from`/`via`/`to`, `divide`, `outline`, `shadow` and more), with variant prefixes, shades and opacity. It also scans `ui/card.tsx`, and a table of examples checks the pattern itself.
>
> Web lint, typecheck, tests (64 files, 589 tests) and build pass. `/ask` was then checked in Chrome in light and dark: example links, typed questions, the "Searching..." loading state, the field error, a deal-scoped question from a deal page, malformed and nonexistent `dealId`s, Clear scope and keyboard focus order. The running API had no `ANTHROPIC_API_KEY`, so the LLM answer card, markers and cited highlighting were not seen in the browser; unit tests cover them.

### Summary
The `/ask` page is correct and complete against the spec. Model output is only rendered as React text nodes plus `TextLink`s we build. There is no `dangerouslySetInnerHTML`. The citation regex is linear and cannot backtrack catastrophically, and only known `S\d+` labels become `#source-Sn` links. The page metadata sets noindex. `next/form` is used with a string action, as the Next 16 docs describe: no `key`, `method`, `encType` or `target` props on `Form`. Data is fetched only on the server through `lib/api.ts`, and `lib/ask.ts` is `server-only`. The keyed Suspense fallback and `loading.tsx` provide the loading state. Deal-scope handling, 400 field errors and 503/404/0 mapping all match the spec, and the API is unchanged. Lint, typecheck, tests (web 572, API 911) and build pass. The only findings are Low: two test tables duplicate coverage, and one heading level is skipped.

### Findings

**Critical**
None

**High**
None

**Medium**
None

**Low**
- `web/tests/unit/source-card.test.tsx:41-55`: the full six-value relevance boundary table (0.75/0.6/0.59/0.4/0.39/0.25) repeats `web/tests/unit/ask-display.test.ts:30-41`. `relevance-indicator.test.tsx:7-19` also covers the level-to-meter mapping. This goes against CLAUDE.md's "do not duplicate coverage". Fix: keep the boundaries only in `ask-display.test.ts`. In `source-card.test.tsx`, keep one representative case that proves the wiring (`similarity` -> "Relevance: X" text, meter `aria-valuetext`, no "%" and no raw number).
- `web/tests/unit/ask-results.test.tsx:94-101`: the rethrow table (500, 503 with another code) duplicates `web/tests/unit/ask.test.ts:72-80`. `AskResults` only needs one representative case to prove it does not swallow errors from `runAsk`. Fix: reduce it to a single case.
- `web/src/components/ask/answer-card.tsx:7` / `web/src/components/ask/source-list.tsx:13`: the "Answer" card title is an `h3` (`CardTitle`) that comes before the `h2` "Sources", so the heading level jumps from the page `h1` straight to `h3`. Other pages use the same Card pattern, so this is minor. Optional fix: make the Sources heading consistent with the card titles, or skip no levels in the result area.
- `web/tests/unit/ask-static-rules.test.ts:23-25`: the palette regex only checks the `bg-`, `text-` and `border-` prefixes, so palette colors in `ring-`, `fill-`, `stroke-`, `divide-`, `from-` and similar classes would get through. Also, the modified `components/ui/card.tsx` is not in the list. The code reviewed is clean. This is only about how strong the guard test is. Optional fix: widen the prefix group and add `card.tsx`.

### Security notes (verified, no findings)
- `web/src/components/ask/answer-text.tsx:9-17`: text segments are plain strings that React escapes. Citation links are built from `segment.label`, which can only be a `S\d+` match that is also in the response's label set, so `href` can only take the form `#source-S<digits>`.
- `web/src/lib/citations.ts:4-5`: in `/\[\s*(S\d+(?:\s*,\s*S\d+)*)\s*\]/g` the repeated group is anchored by literal `,` and `S`, so there is no ambiguous nested quantifier. Each attempt that starts at a `[` costs O(length to the next failure), so matching is linear in practice. `LABEL` (`/S\d+/g`) is greedy, so `[S10]` gives `S10`, not `S1` plus `0`. `matchAll` clones the global regex, so no `lastIndex` state is shared between calls.
- `web/src/components/ask/source-card.tsx:15`: React escapes the `id={`source-${label}`}` attribute. Only labels that match the source cards' ids are ever linked.
- `web/src/lib/ask-display.ts:23-35`: every href is built with `URLSearchParams`, with no string concatenation of user input.
- `web/src/lib/ask.ts:1`, `web/src/lib/api.ts:1`: both import `server-only`. Nothing on the browser side calls the API.

### Spec adherence
Every acceptance criterion is met:
1. `metadata` = `{ title: "Ask your CRM", robots: { index: false } }` (`app/ask/page.tsx:7`). Met.
2. Static `PageHeader` heading "Ask your CRM", with `searchParams` read only inside Suspense. Met.
3. Form named "Ask your CRM", textbox "Question" with `name="q"`, "Ask" button, three exact example links built with `URLSearchParams`, and no `askCrm` call. Met.
4. Scoped examples include `dealId`, plus a hidden `dealId` input. Met.
5. "Scoped to: {title}" notice, "Clear scope" link keeps `q`, and `askCrm` receives `dealId`. Met.
6. 404 or 400 on the scope deal shows only the notice and the clear link: no form, examples or search, and no `notFound` (`loadOptionalResource`). Met.
7. `getDeal` with status 0 renders `ApiUnavailable` and no search. Met.
8. Unscoped body has no `dealId` key, and `askCrm` sends `POST /ask` as JSON. Met.
9 to 11. Marker parsing, groups, unknown and mixed labels, and HTML rendered as literal text. Met.
12 to 13. Cited badge plus `border-accent` through `Card.highlighted`, and card ids and fields. Met.
14. Relevance bands, meter ARIA attributes, and no "%". Met.
15 to 18. The three answer states, DOM order of the notices, and EmptyState only for empty sources. Met.
19 to 22. 400 field error with aria attributes, other issues as a `FormError`, 503 `EMBEDDING_UNAVAILABLE`, 404, status 0, and rethrow of other errors to `app/ask/error.tsx`. Met.
23. `AskPending` shows a disabled input with the question, a disabled "Searching..." button and a status named "Searching the notes". The keyed Suspense uses `askHref({question, dealId})` as its key. Met.
24. DealView link "Ask about this deal" with href `/ask?dealId={id}`. Met.
25. No `dangerouslySetInnerHTML`. Colors are tokens only (`border-accent`, `bg-accent`, `bg-surface-hover`, `text-muted`, `text-foreground`). Accent is not a state color, and state colors appear only in `FormError`. Met.
26. Web lint, typecheck, test and build pass, and API lint, typecheck and tests pass (test report). Met.

Deviations accepted:
- `errorProps` moved to `lib/error-props.ts` and is re-exported from `browser-validation.ts`. This is justified: the `useState` import in `browser-validation.ts` cannot go into a Server Component, and existing callers are unchanged.
- `next/form` is mocked in unit tests because it needs the app router.
- There is a shared `ask-fixtures.ts`.

No new dependencies, and nothing under `api/` or `.claude/` was changed. The coverage gaps the tester listed are acceptable and match how the repo handles them elsewhere: real `next/form` navigation, keyed Suspense re-showing the fallback, and no tests for `loading.tsx`/`error.tsx` (the companies equivalents have none either).

### Verdict
The change is correct, complete, secure and follows the conventions. There are no Critical, High or Medium findings, all acceptance criteria are met, and there are no open test failures. The Low findings (test duplication, one heading level, a guard regex that could be stronger) are cleanup and do not block.

STATUS: PASS
