# Implementation: Deals pages of the web dashboard

## Summary

Built `/deals` (paginated, prioritized list) and `/deals/[id]` (details, next-action panel, interactions timeline, add-interaction form, stage selector) in the Next.js 16 dashboard. Added the small API change from D2: `RuleBasedScorer` now names the close-date factor `closeDatePassed` when the date is in the past. Points, scores, reasons, next actions and ordering are unchanged. No dependencies were added.

## Files changed

API
- `api/src/scoring/priority-scorer.ts`: `RuleFactorName` includes `"closeDatePassed"`.
- `api/src/scoring/rule-based-scorer.ts`: `closeDateFactorName()` picks the factor name; `factorPhrase` handles both close-date names with the same reason text.
- `api/tests/unit/rule-based-scorer.test.ts`: close-date table now checks the factor name and points (`-1` gives `closeDatePassed`, 0/7/8/30 give `closeDate`); added a 31-day case and updated the "very old date" test.
- `api/tests/integration/deals-priority.test.ts`: new test for an overdue deal's next-action factors.

Web lib
- `web/src/lib/types.ts`: response and request types, `DEAL_STAGES`, `INTERACTION_TYPES`.
- `web/src/lib/api.ts`: `DEAL_CLOSED` and the 7 endpoint functions.
- `web/src/lib/messages.ts` (new): `API_NOT_RUNNING_MESSAGE`.
- `web/src/lib/format.ts` (new): `formatValue`, `formatDate`.
- `web/src/lib/deal-display.ts` (new): labels, badge variants, `isOverdue`, `formatPoints`, `scoredByLook`.
- `web/src/lib/pagination.ts` (new): `parsePageParam`, `DEALS_PAGE_SIZE`.
- `web/src/lib/form-state.ts` (new): form state types, `initialFormState`, `toFormErrors`.
- `web/src/lib/load.ts` (new, server-only): `loadResource`, `loadCollection`.

Web UI primitives
- `web/src/components/ui/skeleton.tsx`, `pagination.tsx`, `description-list.tsx` (new).
- `web/src/components/ui/field.tsx`: added `FormError`.

Web components
- `web/src/components/api-unavailable.tsx` (new).
- `web/src/components/health-badge.tsx`: uses `API_NOT_RUNNING_MESSAGE` (same text).
- `web/src/components/sidebar.tsx`: `SidebarNav` wrapped in `<Suspense fallback={null}>` (see Deviations).
- `web/src/components/deals/` (new): `stage-badge`, `overdue-badge`, `deals-table`, `prioritized-deals`, `deals-table-skeleton`, `deal-view`, `deal-details-card`, `next-action-panel`, `next-action-card`, `closed-deal-notice`, `factors-list`, `scored-by-badge`, `interaction-timeline`, `interaction-form`, `stage-form`, `deal-detail-skeleton`.

Web routes
- `web/src/app/deals/page.tsx`, `loading.tsx`, `error.tsx`.
- `web/src/app/deals/[id]/page.tsx`, `loading.tsx`, `actions.ts`.

Web tests (`web/tests/unit/`)
- `api.test.ts` (extended), `format.test.ts`, `pagination.test.tsx`, `factors-list.test.tsx`, `scored-by-badge.test.tsx`, `deals-table.test.tsx`, `next-action-panel.test.tsx`, `interaction-timeline.test.tsx`, `interaction-form.test.tsx`, `deal-actions.test.ts`.

## Deviations from spec

1. `web/src/components/sidebar.tsx` modified (not in the spec). The first `next build` failed on `/deals/[id]` with "usePathname() in a Client Component outside of Suspense": the sidebar's `usePathname()` is request-time data on a dynamic route, and Cache Components blocks prerendering. Wrapping `SidebarNav` in `<Suspense fallback={null}>` fixes it. Cost: the nav links appear a moment after the shell instead of in it.
2. `pagination.test.ts` is `pagination.test.tsx` because it renders the `Pagination` component (JSX).
3. `InteractionForm`'s type `Select` has `key={values?.type ?? "default"}`. Without it the select went back to "Note" after a failed submit: React resets uncontrolled forms after an action, and the select did not pick up the new `defaultValue`. The key remounts it with the submitted type. The test "keeps the submitted values after an error" caught this.
4. Small additions not named in the spec: `Pagination` and `Skeleton` have no extra props; `DealsTableSkeleton` and the detail skeletons use `role="status"` with an `aria-label`.

## Non-obvious decisions (plain English)

- D1, company name: the detail endpoint returns no company name, so the page calls `GET /companies/:companyId` too. That avoids changing the API for one label.
- D2, overdue: the web app never compares dates. It shows "Overdue" only if the API's `factors` contains `closeDatePassed` (`isOverdue` in `deal-display.ts`). The scoring rule stays in the API; the UI only reads its answer. A test proves this: a row with a past date but no such factor shows no badge.
- D3, API down: Server Components catch the status-0 error and render `ApiUnavailable`. We do this because in production `error.tsx` only gets a redacted error and cannot tell "API down" from other failures. `error.tsx` is the generic fallback for everything else.
- D4, dates: formatted only on the server, in UTC. Client components never format dates or numbers, so server and browser output cannot differ (no hydration mismatch). A timestamp near midnight can show the UTC day, not the local day. Accepted for a single-user app.
- D5, form date: `<input type="date">` gives `YYYY-MM-DD`; the action turns it into `...T00:00:00.000Z` and leaves `occurredAt` out when empty (the database then uses "now"). The API stays the only validator, so the forms use `noValidate` and show whatever the API returns under the field.
- Server Actions return a `FormState` value (used with `useActionState`) instead of throwing for validation errors. The types and `initialFormState` live in `lib/form-state.ts` because a `"use server"` file may export only async functions. That file imports `ApiError` as a type only, so client bundles do not pull in the server-only API client.
- `loadResource` calls `notFound()` for 404 and for 400 `VALIDATION_ERROR` (a non-UUID id like `/deals/foo`). Status 0 becomes "unreachable"; anything else is rethrown to `error.tsx`.
- The stage form has `key={deal.stage}`, so after a successful change it remounts and its select shows the new stage.
- `page.tsx` files are not async and only pass the `searchParams`/`params` promises into Suspense-wrapped components, so the static shell (header, skeleton) can be prerendered. The build output shows `/deals` and `/deals/[id]` as Partial Prerender.

## Notes for tester/reviewer

- Run from the repo root: `npm --prefix web run lint|typecheck|test|build`, `npm --prefix api run lint|typecheck|test`.
- No new env vars. The web app still needs `API_URL`.
- Not verified by hand: light/dark themes and keyboard-only use (no browser available here). New files use token classes only (`text-muted`, `text-danger`, `bg-surface-hover`, ...), no raw colors or Tailwind palette classes. Please check it in a browser.
- `/companies/{id}` links lead to the not-found page (route not built yet), as the spec says.
- `notFound()` inside Suspense keeps HTTP 200 (documented, accepted).
- The pre-existing dev servers were left running. `next build` ran fine alongside the dev server (no `.next` conflict).
- Risk: the `closeDatePassed` name is new for any other client of `/deals/:id/next-action` or `/deals/prioritized`; only the web app consumes them today.

## Command results

- `npm --prefix api run lint`: pass.
- `npm --prefix api run typecheck`: pass.
- `npm --prefix api test` (unit and integration, DB running): 41 files, 879 tests passed.
- `npm --prefix web run lint`: pass, no warnings.
- `npm --prefix web run typecheck`: pass.
- `npm --prefix web run test`: 15 files, 118 tests passed.
- `npm --prefix web run build`: pass with Cache Components. `/deals` and `/deals/[id]` are Partial Prerender.

Suggested commit: `feat: add deals list and deal detail pages to the web dashboard`
