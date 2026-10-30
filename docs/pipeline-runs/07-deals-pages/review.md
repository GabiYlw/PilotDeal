> **Note:** The Medium finding and all Low findings were fixed after this pipeline run, in the same commit. The sidebar renders the same nav links without the highlight as the Suspense fallback. The stage select keeps the chosen stage after a failed update. New tests cover the "Adding..." state, clearing after success and the sidebar fallback. The duplicated factor-label tests were removed. The date-format test pins a UTC+14 zone before import. The scorer comment and the error page text were fixed. The optional `lib -> components/ui` type import was left as is.

# Review: Deals pages of the web dashboard

## Summary

The change is correct, follows the spec closely, and keeps to the architecture. The API change (D2) is purely additive: points, reasons, next actions and ordering are unchanged, and the `factorPhrase` switch is still exhaustive. The web app has no business logic. `isOverdue` only reads the API's `closeDatePassed` factor, and a test proves that a past date without that factor shows no badge. All data loading happens on the server through `lib/api.ts`. Server Actions live in a `"use server"` file that exports only async functions. `notFound()`, `error.tsx` (with the Next 16 `retry` prop), `loading.tsx`, Suspense around `params`/`searchParams` and `revalidatePath` all match the bundled Next 16 docs. Dates are formatted only in Server Components, in UTC, so hydration is safe. Forms use `Label`/`htmlFor`, `aria-invalid`, `aria-describedby` and `role="alert"` correctly. New files use only token colors.

There are no Critical or High findings. The main issue is the sidebar `<Suspense fallback={null}>`. On routes with an unknown dynamic param (`/deals/[id]`), the main navigation is missing from the prerendered shell. On mobile, the nav row then appears late and pushes the page down. A static fallback with the same links would fix this. The other findings are small test-quality and consistency nits.

## Findings

### Critical
None

### High
None

### Medium

- **`web/src/components/sidebar.tsx:24`: `fallback={null}` removes the main nav from the static shell on dynamic routes.** `use-pathname.md` ("Cache Components") says `usePathname` suspends on routes whose dynamic param is not covered by `generateStaticParams`. So on `/deals/[id]` the prerendered shell has no `<nav aria-label="Main">`. The links only appear when the dynamic part streams in (initial load only; client navigations keep the layout). Below `md` the aside is a top bar (`flex-col`), so the nav row appearing late shifts the whole page down (layout shift). Until then there are no links to reach by keyboard or screen reader. **Fix:** render the same links, with no active state, as the fallback, so the space and the links are in the shell from the start. For example, move the `<ul>` into a presentational `NavLinks({ pathname }: { pathname?: string })` (no hooks), have `SidebarNav` render `<NavLinks pathname={usePathname()} />`, and use `<Suspense fallback={<NavLinks />}>`. Keep the explanatory comment.

### Low

- **`web/src/components/deals/stage-form.tsx:22-25`: `defaultValue={state.values?.stage ?? stage}` has no effect after an error.** As implementation.md deviation 3 notes, React does not apply a changed `defaultValue` to a mounted `<select>`, and it resets the form after the action. So after a failed update (status 0, 404, 500) the select silently goes back to the current stage, and the returned `values` are ignored. This differs from `InteractionForm`, which uses a `key` for this reason. **Fix:** either add `key={state.values?.stage ?? stage}` to the `Select` so it remounts with the submitted value, or stop returning and reading `values` for the stage form and say in a comment that the select deliberately shows the saved stage.
- **`web/tests/unit/interaction-form.test.tsx`: requirement 17's pending state and clear-on-success behavior are not tested.** `stage-form.test.tsx:68-83` tests "Updating..." and the disabled button, but nothing checks "Adding..." / `disabled` (`interaction-form.tsx:73-75`). Nothing checks that the fields clear after a success either. **Fix:** add a pending test like the stage-form one. Also add one that resolves with `{ status: "success", fieldErrors: {} }` after typing notes and expects the textarea to be empty and the type to be `NOTE`.
- **`web/tests/unit/factors-list.test.tsx:7-22` duplicates `web/tests/unit/deal-display.test.ts:6-25`.** Both are table tests of every label and sign (`closeDatePassed`, the AI factor, an unknown name, `+N`/`-N`/`0`). CLAUDE.md says "Do not duplicate coverage". **Fix:** keep the full tables in `deal-display.test.ts`, and trim the component test to one representative row plus the "one item per factor" and empty-list cases that AC 7 needs.
- **`web/tests/unit/format.test.ts:16-22`: the "whatever the process time zone" claim (requirement 24) depends on the machine's time zone.** If the tests run with `TZ=UTC` (typical in CI or containers), removing `timeZone: "UTC"` from `format.ts:16` would not fail any test. **Fix:** pin a non-UTC zone for this test, for example `process.env.TZ = "Pacific/Kiritimati"` (UTC+14) in a `beforeAll`, or a dedicated `test.env` in `vitest.config.mts`, so the 23:30Z row fails if the UTC option is dropped.
- **`web/tests/unit/deal-display.test.ts:38-42`: three cases in one `it`.** CLAUDE.md prefers `it.each` for cases that differ only in input and output. **Fix:** turn it into `it.each([[closeDatePassed, true], [closeDate, false], [[], false]])`.
- **`api/src/scoring/rule-based-scorer.ts:110`: stale comment.** "The closeDate factor only exists when there is a date" now applies to both `closeDate` and `closeDatePassed`. **Fix:** reword it to "The close-date factors only exist when there is a date".
- **`web/src/app/deals/error.tsx:18`: the copy says "The deals could not be loaded." on the detail page too.** This boundary also catches `/deals/[id]` errors. **Fix:** use neutral text such as "This page could not be loaded."
- **`web/src/lib/deal-display.ts:1`: `lib/` imports a type from `components/ui/badge`.** It is type-only, so there is no runtime effect, but it reverses the usual `components -> lib` direction. Optional: accept it, or move `BadgeVariant` to a shared type module.

## Spec adherence

| AC | Status | Notes |
|---|---|---|
| 1 | Met | `rule-based-scorer.test.ts` row -1 checks `closeDatePassed`/25 and no `closeDate` |
| 2 | Met | rows 0/7/8/30 check name and points, and that `closeDatePassed` is absent; 31-day and null cases kept |
| 3 | Met | new integration test in `deals-priority.test.ts:282`; the existing 5-day test is unchanged |
| 4 | Met | ordering tests unchanged; API lint, typecheck and 879 tests pass (test report) |
| 5 | Met | `api.test.ts` table: exact URLs, methods, JSON bodies; plus an `encodeURIComponent` test |
| 6 | Met | 404 `NOT_FOUND`, 409 `DEAL_CLOSED`, 400 with `details` kept |
| 7 | Met | `factors-list.test.tsx` (but see the duplication finding) |
| 8 | Met | `scored-by-badge.test.tsx`, table-driven |
| 9 | Met | `deals-table.test.tsx:43-59`; the past-date-without-factor case proves there is no date logic |
| 10 | Met | link href, rank 21/22, "60,000", `aria-valuenow` |
| 11 | Met | `next-action-panel.test.tsx` (200, overdue, 409 with no meter, status 0, rethrow) |
| 12 | Met | `interaction-form.test.tsx` (field error plus aria wiring, form alert, labels) |
| 13 | Met | `interaction-timeline.test.tsx` |
| 14 | Met | `pagination.test.tsx` |
| 15 | Met | `format.test.ts` (but see the time zone finding) |
| 16 | Met | `pagination.test.tsx` `parsePageParam` table |
| 17-21 | Met | `deal-actions.test.ts`, `form-state.test.ts` |
| 22 | Met | web lint, typecheck, test (182) and build pass with Cache Components; both routes are Partial Prerender |
| 23 | Partially verified | No raw colors or palette classes in the new files (confirmed by reading every file). The manual light/dark and keyboard check in a browser is still for the human reviewer. |

Requirements checked beyond the ACs:
- No `fetch` in components.
- Client Components import only types, `initialFormState` and display maps. They never import `lib/api.ts` at runtime: `form-state.ts` uses `import type`.
- `noValidate` is set on both forms.
- `key={deal.stage}` remounts the stage form after a successful change.
- 409 shows the closed notice.
- A 400 for a non-UUID id calls `notFound()`.
- `ApiUnavailable` is wrapped in `role="alert"`.
- Notes use `whitespace-pre-line break-words`.
- No new dependencies.

## Verdict

There are no Critical or High findings. Every automated acceptance criterion is met and tested, and there are no open test failures. Layering, the Next 16 APIs, hydration safety, accessibility and token-only styling are all correct. The sidebar fallback (Medium) is a UX and layout-shift regression on dynamic routes, outside the spec's scope, with a small, well-defined fix. It and the Low items should be addressed before commit, but none of them makes the feature incorrect or unsafe. AC 23's manual browser check is for the human reviewer.

STATUS: PASS
