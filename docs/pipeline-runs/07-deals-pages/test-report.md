# Test report: Deals pages of the web dashboard

## Summary

- Framework: Vitest (web: jsdom + React Testing Library; API: Vitest + Supertest against `pilotdeal_test`).
- Result: all green. No product defects found.
- Web tests: 21 files, 182 tests passed (118 existed from the coder, 64 added by the tester).
- API tests: 41 files, 879 tests passed (unit + integration, DB running).
- `npm --prefix web run lint`, `typecheck`, `build` pass (build with Cache Components; `/deals` and `/deals/[id]` are Partial Prerender). `npm --prefix api run lint`, `typecheck` pass.
- Commands: `npm --prefix web run test`, `npm --prefix api test`, plus the lint/typecheck/build commands above. No servers were started or stopped.
- Static grep over new `components/deals`, `app/deals` and new ui files: no raw hex/rgb or Tailwind palette colors, and no `fetch(` in components or app.
- Not verified (no browser): AC 23 manual light/dark theme and keyboard check.

## Tests added (by tester, `web/tests/unit/`)

| File | Covers |
|---|---|
| `form-state.test.ts` | Req 19 / AC 19, 21 and edge cases: first message per field; empty or unknown `path` goes to form error; `details` not an array, empty, or malformed uses `error.message`; status 0, 404, 409, 500 messages |
| `deal-display.test.ts` | Req 15 labels (all 6 factor names, unknown name, `toString` prototype key), `formatPoints` (+N, -N, 0), stage badge variants, `isOverdue` only on `closeDatePassed` (AC 7, 9) |
| `load.test.ts` | Req 20: 404 and 400 `VALIDATION_ERROR` call `notFound`; status 0 gives unreachable; other errors rethrown; `loadCollection` does not map 404 |
| `stage-form.test.tsx` | Req 18: 6 stages, default current stage, sends chosen stage, field error with `aria-invalid`/`aria-describedby`, form error `role="alert"`, pending "Updating..." and disabled |
| `prioritized-deals.test.tsx` | Req 9, 12, 21 / edge cases: bad `?page=` values fall back to 1 (undefined, abc, 0, array, 1000000), valid 3 passes through, `pageSize` 20; "No open deals" with no table; "This page is empty" with `/deals` link; API order kept plus next-page link; unreachable hint; 500 rethrown |
| `deal-view.test.tsx` | Req 13, 14, 16, 20, 21: header, company link to `/companies/c1`, "All deals", "Closed on" only when closed, no Overdue in details card, interactions fetched `{page:1,pageSize:100}`, `notFound` for 404 deal, non-UUID 400, 404 company, 404 interactions; unreachable hint from each of the three calls |

Pre-existing tests (written by the coder, reviewed and run): `api.test.ts` (AC 5, 6), `format.test.ts` (AC 15), `pagination.test.tsx` (AC 14, 16), `factors-list.test.tsx` (AC 7), `scored-by-badge.test.tsx` (AC 8), `deals-table.test.tsx` (AC 9, 10), `next-action-panel.test.tsx` (AC 11), `interaction-timeline.test.tsx` (AC 13), `interaction-form.test.tsx` (AC 12), `deal-actions.test.ts` (AC 17-21); API: `rule-based-scorer.test.ts` and `deals-priority.test.ts` (AC 1-4).

## Failures

None in the final run. During authoring, 22 of my new tests failed because I called `new ApiError(status, code, message)`. The real constructor is `(message, status, code, details)`. I fixed my tests; this is not a product defect. Note the spec text for `ApiError(status, code, details)` differs from the real class signature (pre-existing).

## Spec-coverage map

| AC | Status | Tests |
|---|---|---|
| 1 | Covered & passing | `api/tests/unit/rule-based-scorer.test.ts` (-1 day gives `closeDatePassed`/25, no `closeDate`) |
| 2 | Covered & passing | same file, rows 0, 7, 8, 30 (name and points, `closeDatePassed` absent) |
| 3 | Covered & passing | `api/tests/integration/deals-priority.test.ts:282` (overdue) plus the existing 5-day `closeDate`/20 test |
| 4 | Covered & passing | existing ordering tests unchanged; API lint, typecheck, 879 tests pass |
| 5 | Covered & passing | `api.test.ts` |
| 6 | Covered & passing | `api.test.ts` (404, 409, 400 with details) |
| 7 | Covered & passing | `factors-list.test.tsx`, `deal-display.test.ts` |
| 8 | Covered & passing | `scored-by-badge.test.tsx` |
| 9 | Covered & passing | `deals-table.test.tsx` (past date without factor shows no Overdue) |
| 10 | Covered & passing | `deals-table.test.tsx` |
| 11 | Covered & passing | `next-action-panel.test.tsx` (200, overdue, 409, status 0, rethrow) |
| 12 | Covered & passing | `interaction-form.test.tsx` |
| 13 | Covered & passing | `interaction-timeline.test.tsx` |
| 14 | Covered & passing | `pagination.test.tsx` |
| 15 | Covered & passing | `format.test.ts` |
| 16 | Covered & passing | `pagination.test.tsx` (`parsePageParam`) |
| 17-21 | Covered & passing | `deal-actions.test.ts`, `form-state.test.ts` |
| 22 | Covered & passing | web lint, typecheck, test, build all run and pass |
| 23 | Untestable here | Manual light/dark and keyboard check needs a browser. Static grep found no raw colors or palette classes in the new files. |

## Regressions

None. All 118 pre-existing web tests and all pre-existing API tests pass, including `health-badge.test.tsx` after the `API_NOT_RUNNING_MESSAGE` change.

## Observations (not defects)

- `sidebar.tsx` was modified outside the spec (Suspense around `SidebarNav`); disclosed in implementation.md as a deviation. Existing tests still pass.
- `notFound()` inside Suspense keeps HTTP 200 (documented and accepted in the spec).
