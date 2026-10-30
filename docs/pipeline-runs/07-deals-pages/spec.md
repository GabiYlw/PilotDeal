# Spec: Deals pages of the web dashboard

## Task

Build `/deals` (the prioritized list from `GET /deals/prioritized`, paginated) and `/deals/[id]` (deal details, next-action panel, interactions timeline, an add-interaction form and a stage selector) in the Next.js 16 dashboard. Follow the Web rules and UI rules in `CLAUDE.md`. For the overdue highlight to come from the API, one small additive API change is needed: a `closeDatePassed` factor name.

## Findings from the codebase (read before coding)

These are the real API response shapes. JSON turns every `Date` into an ISO string.

| Endpoint | Status | Body |
|---|---|---|
| `GET /deals/prioritized?page&pageSize` | 200 | `{ data: { deal: Deal & { companyName }, priority: PriorityResult }[], meta: { page, pageSize, total } }`. Only open deals, already sorted. `pageSize` max 100, default 20. A page past the end returns `data: []` with the real `total`. |
| `GET /deals/:id` | 200 | `Deal`. **No `companyName`** (see decision D1). |
| `GET /deals/:id/next-action` | 200 | `{ dealId, score, reason, nextAction, factors: { name, points }[], scoredBy: "rules" \| "llm" }` |
| | 409 | `{ error: { code: "DEAL_CLOSED", message: "Deal <id> is closed (WON)" } }` |
| `PATCH /deals/:id` | 200 | `Deal`. The body is a strict object (`title?`, `value?`, `stage?`, `expectedCloseDate?`) with at least one key. |
| `GET /deals/:dealId/interactions?page&pageSize` | 200 | `{ data: Interaction[], meta }`, ordered by `occurredAt desc, id desc` (newest first) |
| `POST /deals/:dealId/interactions` | 201 | `Interaction`. Strict body: `type` (EMAIL/CALL/MEETING/NOTE), `notes` (trimmed, 1..5000), `occurredAt?` (ISO datetime **with offset**, >= 1900-01-01, not in the future). If `occurredAt` is omitted, the database sets "now". |
| `GET /companies/:id` | 200 | `Company { id, name, industry, website, createdAt, updatedAt }` |
| Any by-id route, missing id | 404 | `{ error: { code: "NOT_FOUND", message } }` |
| Any by-id route, non-UUID id | 400 | `{ error: { code: "VALIDATION_ERROR", message: "Invalid route parameters", details } }` |
| Invalid body | 400 | `{ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: { path: (string\|number)[], message: string }[] } }` |

- `Deal` = `{ id, companyId, title, value: number, stage, expectedCloseDate: "YYYY-MM-DD" | null, closedAt: string | null, createdAt: string, updatedAt: string }` (`api/src/modules/deals/deals.schemas.ts`, `deals.repository.ts#toDeal`).
- `Interaction` = `{ id, dealId, type, notes, occurredAt, createdAt, updatedAt }`. All dates are ISO strings. The embedding is never returned (`api/src/modules/interactions/interactions.schemas.ts`).
- Factor names (`api/src/scoring/priority-scorer.ts`) are `"daysSinceContact" | "closeDate" | "stage" | "value"`, plus `"AI adjustment from interaction notes"`. `LlmScorer` adds that last factor, and its points can be negative. Factors with 0 points are filtered out. Factors always sum to `score`.
- `RuleBasedScorer.closeDatePoints` gives 25 points for a past date, 20 for 0-7 days ahead and 10 for 8-30 days ahead. **Today the API has no explicit "overdue" signal.** The only clue is `closeDate` with 25 points, and reading that in the web app would copy a scoring rule into the UI. See D2.
- `web/src/lib/api.ts` already has `apiRequest<T>`, `ApiError(status, code, details)`, `API_UNREACHABLE` and `UNEXPECTED_RESPONSE`. Tests stub `fetch` (`web/tests/unit/api.test.ts`). `vitest.config.mts` aliases `server-only` to an empty module. Tests render async Server Components with `render(await Component(props))` (`web/tests/unit/health-badge.test.tsx`).
- `@testing-library/user-event` is **not** installed. Use `fireEvent` and `act` from `@testing-library/react`. Do not add a dependency.
- In production, `error.tsx` receives a redacted `Error` for anything thrown by a Server Component (`web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`, section on `error.message`). So it **cannot** tell "API unreachable" apart from other errors. The unreachable case must be caught on the server and rendered (D3).

### Decisions

- **D1 (company name on the detail page): no API change.** The detail page calls `GET /deals/:id`, then `GET /companies/:companyId`, which already exists. The prioritized list already includes `companyName`.
- **D2 (overdue): small additive API change.** When the expected close date is in the past, `RuleBasedScorer` emits the factor name `closeDatePassed` instead of `closeDate`. The points stay the same (25), so scores, ordering, reasons and next actions do not change. The web app shows "Overdue" exactly when `factors` contains `closeDatePassed`. Without this change the web app would have to compare dates or hard-code "25 points means overdue", and both are business logic. `LlmScorer` copies the baseline factors, so the name passes through.
- **D3 (unreachable API): handled on the server.** Server Components that load data catch `ApiError` with status 0 and render an `ApiUnavailable` block. It shows the same hint as the health badge: "API is not running. Start it with npm --prefix api run dev." `app/deals/error.tsx` is the generic fallback for everything else. It shows the same hint as the most likely cause, plus a "Try again" button.
- **D4 (dates): formatted on the server, in UTC.** All formatting happens in Server Components with `Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })`, which gives "Oct 22, 2026". Nothing is formatted in a Client Component, so server and browser output cannot differ and there is no hydration mismatch. `YYYY-MM-DD` values are read as UTC midnight, the same way the API repository reads them, so they show exactly the stored date. Timestamps (`occurredAt`, `closedAt`) show their UTC calendar day. Near midnight that can be one day off from the user's local day. This trade-off is accepted for a single-user app with no time zone setting.
- **D5 (optional date in the form): `<input type="date">`.** An empty value leaves out `occurredAt`, so the API uses "now". A value `YYYY-MM-DD` is sent as `YYYY-MM-DDT00:00:00.000Z`. This round-trips with D4: the timeline shows the date the user picked. If the user picks "today" while UTC is still on the previous day, the API rejects it with "occurredAt cannot be in the future", and the form shows that message next to the date field. The API stays the only validator.

## Requirements

### API (D2)
1. `RuleBasedScorer` returns the factor `{ name: "closeDatePassed", points: 25 }` for a deal whose expected close date is before today (UTC day). It never returns `closeDate` for that deal.
2. For an expected close date 0-30 days ahead, the factor is still `closeDate` with the current points (20 or 10). With no date, or a date 31 or more days ahead, there is no close-date factor.
3. Scores, reasons, next actions and the prioritized order are unchanged for every input.
4. `RuleFactorName` (and therefore `PriorityFactorName`) includes `"closeDatePassed"`. TypeScript strict mode, lint and all API tests pass.

### Web: data layer
5. `web/src/lib/types.ts` mirrors the API shapes in the findings table: `Deal`, `DealWithCompany`, `PriorityFactor`, `PriorityFactorName` (including `closeDatePassed`), `ScoredBy`, `PriorityResult`, `PrioritizedDeal`, `DealNextAction`, `Interaction`, `Company`, `ValidationIssue` and the request body types. `DEAL_STAGES` and `INTERACTION_TYPES` are exported as `as const` arrays.
6. `web/src/lib/api.ts` exports one function per endpoint: `getPrioritizedDeals`, `getDeal`, `getDealNextAction`, `getCompany`, `getDealInteractions`, `createDealInteraction` and `updateDeal`. Each one calls `apiRequest` with the right path, method and JSON body. Path ids go through `encodeURIComponent`. Errors surface as `ApiError` with the API's `status`, `code` and `details`.
7. No component calls `fetch` directly. All API calls happen on the server, in Server Components or in the Server Actions in `app/deals/[id]/actions.ts`.

### Web: `/deals`
8. `PageHeader` with the title "Deals" and a description saying that open deals are ranked by priority.
9. Reads `?page=` from `searchParams`. A missing or invalid value (anything that does not match `^[1-9]\d{0,5}$`) means page 1. Calls `getPrioritizedDeals({ page, pageSize: 20 })`.
10. A `Table` with the columns Rank, Deal, Company, Stage, Value, Expected close, Score and Reason, in the API's order (no re-sorting):
    - Rank = `(meta.page - 1) * meta.pageSize + index + 1`.
    - Deal = the title as a `TextLink` to `/deals/{id}`. This is the row's link to the deal page.
    - Company = `deal.companyName` as plain text.
    - Stage = a `Badge` with a readable label (Lead, Qualified, Proposal, Negotiation, Won, Lost). Variant: neutral for open stages, success for WON, danger for LOST.
    - Value = formatted with thousands separators, right-aligned, tabular numbers.
    - Expected close = the formatted date, or "No date" in muted text when it is `null`. A danger `Badge` "Overdue" appears **if and only if** `priority.factors` contains a factor named `closeDatePassed`.
    - Score = `ScoreBar` with `score={priority.score}` and `label={"Priority score for " + title}`.
    - Reason = `priority.reason` in muted text.
11. Pagination under the table, based on `meta`:
    - The text "Showing {from}-{to} of {total}", with "Previous" and "Next" controls.
    - Previous is disabled on page 1. Next is disabled when `page * pageSize >= total`.
    - Enabled controls are links to `/deals?page=N`.
    - Pagination is not rendered when `total <= pageSize` and `page === 1`.
12. With `total === 0`, an `EmptyState` "No open deals" replaces the table. With `data.length === 0` and `total > 0` (page past the end), an `EmptyState` "This page is empty" with a `ButtonLink` to `/deals` replaces it.

### Web: `/deals/[id]`
13. Header: `PageHeader` with `title = deal.title` and the description "Company: {company.name}". The company name is a `TextLink` to `/companies/{companyId}`. That route does not exist yet, so the link leads to the not-found page. `actions` holds a small `TextLink` "All deals" to `/deals`.
14. A details `Card` with a description list: Stage (badge), Value (formatted), Expected close (formatted, or "No date"), and "Closed on" (formatted `closedAt`), shown only when `closedAt` is not null. The details card does **not** show an overdue badge. On the detail page the overdue highlight lives in the next-action panel, which has the factors (requirement 15, assumption 1).
15. Next action panel from `getDealNextAction(id)`, in its own `<Suspense>` with a skeleton fallback:
    - Shows `nextAction` (prominent), `ScoreBar` (score), `reason`, and a badge for `scoredBy`: `rules` gives a neutral `Badge` "Scored by rules", `llm` gives an accent `Badge` "Scored by AI".
    - Shows the same `OverdueBadge` as the list (danger "Overdue") if and only if `factors` contains `closeDatePassed`.
    - Lists every factor with a readable label and signed points (`+20`, `-5`, `0`). Labels:
      - `daysSinceContact`: "Days since last contact"
      - `closeDate`: "Close date approaching"
      - `closeDatePassed`: "Close date passed"
      - `stage`: "Stage"
      - `value`: "Deal value"
      - `"AI adjustment from interaction notes"`: the same text
      - any unknown name: the raw name
    - Empty `factors` shows "No scoring factors" in muted text.
    - On 409 `DEAL_CLOSED`: a `Card` with the title "This deal is closed" and the description "Closed deals have no next action." No score and no factors.
    - Status 0 renders `ApiUnavailable`. 404 calls `notFound()`. Any other error is rethrown and handled by `error.tsx`.
16. Interactions timeline from `getDealInteractions(id, { page: 1, pageSize: 100 })`, in API order (newest first), as an ordered list (`<ol>`):
    - Each item shows a type `Badge` (Email, Call, Meeting, Note), the formatted `occurredAt` in a `<time dateTime={occurredAt}>`, and the notes with line breaks kept (`whitespace-pre-line`).
    - With no interactions: an `EmptyState` "No interactions yet".
    - When `meta.total > data.length`: a muted line "Showing the {data.length} most recent of {total} interactions."
17. Add-interaction form (Client Component) with three fields. Each has a `Label` linked by `htmlFor`/`id`:
    - Type: a `Select` with the 4 types, default `NOTE`.
    - Notes: a `Textarea`.
    - Date (optional): an `Input type="date"`.

    Behavior:
    - Submit `Button` "Add interaction". While pending it is disabled and reads "Adding...".
    - The form uses `noValidate`, because the API is the only validator.
    - On a 400, each field with an error shows the message under the field with `FieldError`. The control gets `aria-invalid="true"` and `aria-describedby` pointing at the error id, and the submitted values are kept.
    - Errors that do not map to a field (empty or unknown path, non-validation errors) show as a form-level message with `role="alert"`.
    - On success the fields clear and the page data refreshes (timeline, next action, list).
18. Stage selector (Client Component):
    - `Label` "Stage" and a `Select` with all 6 stages, defaulting to the current stage.
    - Submit `Button` "Update stage". While pending it is disabled and reads "Updating...".
    - It calls a Server Action that calls `PATCH /deals/:id` with `{ stage }`.
    - On 400 it shows the API error message.
    - On success the page refreshes: stage badge, `closedAt` and next-action panel. For example, a deal moved to WON then shows "This deal is closed".
19. Server Actions in `web/src/app/deals/[id]/actions.ts` (`"use server"`):
    - `addInteraction(dealId, prevState, formData)` calls `createDealInteraction(dealId, { type, notes, occurredAt? })`. Values are forwarded as strings. The only web-side processing is the D5 date conversion. `occurredAt` is left out when the date is empty.
    - `updateDealStage(dealId, prevState, formData)` calls `updateDeal(dealId, { stage })`.
    - On success, both call `revalidatePath(`/deals/${dealId}`)` and `revalidatePath("/deals")`, then return a success state.
    - 400 `VALIDATION_ERROR`: return field errors mapped from `details[].path[0]` (first message per field) together with the submitted values. Do not revalidate.
    - Status 0: form error "API is not running. Start it with npm --prefix api run dev."
    - 404: form error "This deal no longer exists."
    - Any other `ApiError`: form error "Could not save. Please try again."
    - Errors that are not an `ApiError` are rethrown.
20. These cases call `notFound()`, which renders `web/src/app/not-found.tsx`:
    - a 404 from `GET /deals/:id`, from the company fetch or from the interactions fetch;
    - a 400 `VALIDATION_ERROR` from `GET /deals/:id` (non-UUID id).
21. When the API is unreachable (status 0), either page renders `ApiUnavailable`: an `EmptyState` with the title "Cannot reach the API" and the description "API is not running. Start it with npm --prefix api run dev.", inside a wrapper with `role="alert"`. Other unexpected errors render `app/deals/error.tsx`.
22. Loading states:
    - `app/deals/loading.tsx` and `app/deals/[id]/loading.tsx` render skeletons.
    - Each page also wraps its data parts in `<Suspense>` with the same skeleton, so the static shell can be prerendered with Cache Components.

### Web: presentation and accessibility
23. `formatValue(60000)` gives "60,000", `formatValue(1234.5)` gives "1,234.50" and `formatValue(0)` gives "0". Integers have no decimals, other values have 2, with `en-US` grouping. There is no currency symbol, because the data model has no currency.
24. `formatDate("2026-10-22")` and `formatDate("2026-10-22T23:30:00.000Z")` both give "Oct 22, 2026", whatever the process time zone.
25. Pages use only components from `web/src/components/ui/` plus layout utilities, and only design-token colors (no raw hex/rgb or Tailwind palette colors). State colors appear only for WON, LOST, overdue and errors. Both themes work, and no new tokens are needed.
26. Every interactive element can be reached and used with the keyboard (Tab) and shows the global `:focus-visible` outline. Do not override `outline`.

## Acceptance criteria

API:
1. `RuleBasedScorer` with an expected close date 1 day ago returns a factor `{ name: "closeDatePassed", points: 25 }` and no factor named `closeDate`.
2. `RuleBasedScorer` with close dates 0, 7, 8 and 30 days ahead returns `closeDate` with 20, 20, 10 and 10 points, and no `closeDatePassed`.
3. `GET /deals/:id/next-action` for an open deal whose close date was yesterday returns 200 with `factors` containing `{ name: "closeDatePassed", points: 25 }`. The existing integration test (close date in 5 days) still returns `{ name: "closeDate", points: 20 }`.
4. The existing ordering and score expectations in `api/tests/integration/deals-priority.test.ts` pass unchanged. `npm --prefix api run lint`, `typecheck` and `test` pass.

Web, API client (`web/tests/unit/api.test.ts`, mocked `fetch`):
5. Each new function calls the exact URL and method, and resolves to the parsed body:
   - `GET {API_URL}/deals/prioritized?page=2&pageSize=20`
   - `GET /deals/{id}`
   - `GET /deals/{id}/next-action`
   - `GET /companies/{id}`
   - `GET /deals/{id}/interactions?page=1&pageSize=100`
   - `POST /deals/{id}/interactions` with JSON body `{"type":"CALL","notes":"Hi"}`
   - `PATCH /deals/{id}` with `{"stage":"WON"}`
6. An API error response becomes an `ApiError` with the same `status` and `code`. At minimum: 404 `NOT_FOUND` (getDeal), 409 `DEAL_CLOSED` (getDealNextAction), and 400 `VALIDATION_ERROR` with `details` kept (createDealInteraction).

Web, components (RTL):
7. The factors list renders one item per factor with its label and signed points: `{daysSinceContact, 20}` gives "Days since last contact" and "+20", and the AI factor with -5 gives "-5". Empty factors render "No scoring factors".
8. The scored-by badge renders "Scored by rules" for `rules` and "Scored by AI" for `llm` (table-driven).
9. Deals table overdue highlight:
   - A row whose factors include `closeDatePassed` shows "Overdue".
   - A row with a past `expectedCloseDate` but **without** that factor does not show "Overdue". This proves the web app does no date comparison.
10. Deals table details:
    - Each title is a link with `href="/deals/{id}"`.
    - Rank starts at 21 on page 2 with pageSize 20.
    - A value of 60000 renders "60,000".
    - The score meter has `aria-valuenow` equal to the score.
11. Next-action panel:
    - When `getDealNextAction` resolves, it shows nextAction, reason and factors. "Overdue" appears only when the factors include `closeDatePassed`.
    - When it rejects with `ApiError(409, "DEAL_CLOSED")`, it shows "This deal is closed" and no meter.
    - With status 0, it shows the "API is not running" hint.
12. Interaction form:
    - When its action returns field errors `{ notes: "Too small" }`, it shows "Too small". The notes textarea has `aria-invalid="true"` and an `aria-describedby` pointing at the element that contains "Too small".
    - A form error shows in a `role="alert"` element.
    - Every field can be found with `getByLabelText` ("Type", "Notes", "Date (optional)").
13. The timeline renders interactions in the given order, with the type label, "Oct 22, 2026"-style dates and the notes. An empty list shows "No interactions yet".
14. Pagination:
    - On page 1 of 3, "Previous" is not a link and "Next" links to `/deals?page=2`.
    - On the last page, "Next" is not a link.
    - With `total <= pageSize` on page 1, nothing renders.
15. `formatValue` and `formatDate` produce the outputs in requirements 23-24 (table-driven).
16. `parsePageParam` returns 1 for `undefined`, `""`, `"0"`, `"-1"`, `"abc"`, `"1.5"`, `["2","3"]` and `"1000000"`, and returns 2 for `"2"`.

Web, Server Actions (`@/lib/api` and `next/cache` mocked):
17. `addInteraction("d1", state, formData{type: CALL, notes: "Hi", occurredAt: "2026-10-22"})` calls `createDealInteraction("d1", { type: "CALL", notes: "Hi", occurredAt: "2026-10-22T00:00:00.000Z" })`. With an empty date, the body has no `occurredAt` key.
18. On success, `revalidatePath` is called with `"/deals/d1"` and `"/deals"`, and the returned state has no errors.
19. When `createDealInteraction` rejects with `ApiError(400, "VALIDATION_ERROR", details=[{path:["notes"], message:"Too small"}])`, the action returns `fieldErrors.notes === "Too small"` and the submitted values, and `revalidatePath` is not called.
20. `updateDealStage("d1", state, formData{stage: "WON"})` calls `updateDeal("d1", { stage: "WON" })` and revalidates `"/deals/d1"`. On a 400 it returns `fieldErrors.stage`.
21. Status 0 returns the "API is not running" form error. 404 returns "This deal no longer exists.". A rejection that is not an `ApiError` is rethrown.

Web, overall:
22. `npm --prefix web run lint`, `typecheck`, `test` and `build` pass. The build succeeds with `cacheComponents: true` (no errors about uncached data outside Suspense).
23. A manual check in the light and dark themes shows readable text, badges and focus outlines on both pages. The new files contain no raw colors and no Tailwind palette classes.

## Edge cases

- **Empty pipeline:** `total 0` shows the "No open deals" empty state and no pagination.
- **Page past the end:** `data []` with `total > 0` shows "This page is empty" with a link to page 1.
- **Bad `?page=`** (`abc`, `0`, `-1`, `1.5`, array, huge number): falls back to page 1, so the API never gets a page it would reject with a 400.
- **Non-UUID deal id** (`/deals/foo`): the API returns 400 `VALIDATION_ERROR`, and the page calls `notFound()`.
- **Deal deleted between requests:** a 404 from the company, interactions or next-action fetch calls `notFound()`. A 404 inside an action returns the form error "This deal no longer exists."
- **Closed deal (WON/LOST):** next-action returns 409, so the panel shows the closed message and the details card shows "Closed on". The stage selector still works. Moving a deal back to an open stage clears `closedAt` (the API does this), and the next action comes back after the refresh.
- **Selecting the same stage:** the API returns 200 with no change. Fine.
- **LLM scorer:** a negative AI adjustment shows as "-N". The AI factor may be present or absent. If the LLM fails, `scoredBy` falls back to rules. The badge always shows what the API says.
- **Null `expectedCloseDate`:** shows "No date". Never overdue, because the API never emits `closeDatePassed` for it.
- **Notes with newlines** are kept (`whitespace-pre-line`). Long notes wrap (`break-words`).
- **Empty or whitespace-only notes, or notes over 5000 characters:** API 400, with the error shown under Notes.
- **Future date, or "today" while UTC is still on the previous day:** API 400, with the error shown under Date (D5).
- **Unknown or empty `details` paths** (for example a strict-object key error) become the form-level error.
- **`details` not in the expected array shape:** use `error.message` as the form error.
- **More than 100 interactions:** shows the 100 most recent plus the note "Showing the 100 most recent of N".
- **API unreachable** on the list, the detail page, next-action or inside an action: shows the friendly hint, no crash.
- **API 5xx or unexpected body:** a page renders `error.tsx`. An action returns the form error "Could not save. Please try again."
- **`API_URL` missing:** stays a thrown configuration error and reaches `error.tsx`. It is not masked as "unreachable", which matches `HealthStatus`.
- **Double submit:** the button is disabled while pending, and React dispatches actions one at a time.
- **Value extremes:** `0` gives "0" and `9999999999.99` gives "9,999,999,999.99".
- **Hydration:** Client Components (the forms) never format dates or numbers. They only receive pre-formatted strings or raw form values.

## Implementation plan

### Files to touch

API (D2):
- `api/src/scoring/priority-scorer.ts`: add `"closeDatePassed"` to `RuleFactorName`.
- `api/src/scoring/rule-based-scorer.ts`: emit `closeDatePassed` for a past close date, and handle it in the `factorPhrase` switch.
- `api/tests/unit/rule-based-scorer.test.ts`: make the close-date table check factor names, and update the "very old close date" test.
- `api/tests/integration/deals-priority.test.ts`: add one next-action test for an overdue deal.

Web, library:
- `web/src/lib/types.ts`: add the response and request types (requirement 5).
- `web/src/lib/api.ts`: add the 7 endpoint functions and a `DEAL_CLOSED` constant.
- `web/src/lib/format.ts` (new): `formatValue`, `formatDate`.
- `web/src/lib/deal-display.ts` (new): label maps and display helpers (stage label and variant, interaction type label, factor label, signed points, `isOverdue`, scored-by look). No `server-only`, because client forms import it.
- `web/src/lib/pagination.ts` (new): `parsePageParam`, `DEALS_PAGE_SIZE = 20`.
- `web/src/lib/form-state.ts` (new, no `server-only`, no `"use server"`): form state types, `initialFormState()`, `toFormErrors()`.
- `web/src/lib/load.ts` (new, `server-only`): `loadResource`, `loadCollection` (D3, notFound mapping).
- `web/src/lib/messages.ts` (new): `API_NOT_RUNNING_MESSAGE`, shared by the badge, `ApiUnavailable`, the actions and `error.tsx`.

Web, UI primitives (the UI rules say to add small missing components to `components/ui`):
- `web/src/components/ui/pagination.tsx` (new): Previous/Next controls plus the range text.
- `web/src/components/ui/skeleton.tsx` (new): a pulsing block (`animate-pulse rounded-md bg-surface-hover`) for loading states.
- `web/src/components/ui/description-list.tsx` (new): `DescriptionList` and `DescriptionItem({ term, children })` (`dl`/`dt`/`dd`, with `text-muted` terms).
- `web/src/components/ui/field.tsx` (modify): add `FormError({ message })`, which renders `<p role="alert" className="text-xs text-danger">` and nothing when there is no message.

Web, feature components (`web/src/components/deals/`, all new):
- `stage-badge.tsx`: `StageBadge({ stage })`.
- `overdue-badge.tsx`: `OverdueBadge({ factors })`. Renders `<Badge variant="danger">Overdue</Badge>` when `isOverdue(factors)`, otherwise null.
- `deals-table.tsx`: `DealsTable({ items, meta })`, a pure table (requirement 10).
- `prioritized-deals.tsx`: `PrioritizedDeals({ searchParams })`, an async Server Component.
- `deals-table-skeleton.tsx`: loading skeleton for the list.
- `deal-view.tsx`: `DealView({ params })`, an async Server Component for the detail page.
- `deal-details-card.tsx`: `DealDetailsCard({ deal })`.
- `next-action-panel.tsx`: `NextActionPanel({ dealId })`, an async Server Component.
- `next-action-card.tsx`: `NextActionCard({ result })`, presentational.
- `closed-deal-notice.tsx`: `ClosedDealNotice()`.
- `factors-list.tsx`: `FactorsList({ factors })`.
- `scored-by-badge.tsx`: `ScoredByBadge({ scoredBy })`.
- `interaction-timeline.tsx`: `InteractionTimeline({ interactions, total })`.
- `interaction-form.tsx`: `"use client"`, `InteractionForm({ action })`.
- `stage-form.tsx`: `"use client"`, `StageForm({ stage, action })`.
- `deal-detail-skeleton.tsx`: `DealDetailSkeleton` and `NextActionSkeleton`.

Web, other components:
- `web/src/components/api-unavailable.tsx` (new): `ApiUnavailable()`.
- `web/src/components/health-badge.tsx` (modify): use `API_NOT_RUNNING_MESSAGE`. The text stays identical, so the existing test still passes.

Web, routes:
- `web/src/app/deals/page.tsx` (new): a non-async page with `PageHeader` and `<Suspense fallback={<DealsTableSkeleton/>}><PrioritizedDeals searchParams={props.searchParams}/></Suspense>`, typed with `PageProps<"/deals">`.
- `web/src/app/deals/loading.tsx` (new): a static header plus `DealsTableSkeleton`.
- `web/src/app/deals/error.tsx` (new, `"use client"`): `EmptyState` "Something went wrong", with `API_NOT_RUNNING_MESSAGE` as the likely cause and `<Button onClick={() => retry()}>Try again</Button>`. Props: `{ error: unknown; retry: () => void }`. Log with `console.error` in an effect, as the docs do.
- `web/src/app/deals/[id]/page.tsx` (new): a non-async page with `<Suspense fallback={<DealDetailSkeleton/>}><DealView params={props.params}/></Suspense>`, typed with `PageProps<"/deals/[id]">`.
- `web/src/app/deals/[id]/loading.tsx` (new): `DealDetailSkeleton`.
- `web/src/app/deals/[id]/actions.ts` (new, `"use server"` at the top): `addInteraction` and `updateDealStage`. **Export only async functions from this file.** Types and the initial state live in `lib/form-state.ts`.

Web, tests (all in `web/tests/unit/`, new unless noted):
- `api.test.ts` (modify): acceptance criteria 5-6, table-driven `it.each` over `[name, call, expectedUrl, expectedInit]`.
- `format.test.ts`: acceptance criterion 15.
- `pagination.test.ts`: acceptance criteria 14 (component) and 16 (`parsePageParam`).
- `factors-list.test.tsx`: acceptance criterion 7.
- `scored-by-badge.test.tsx`: acceptance criterion 8.
- `deals-table.test.tsx`: acceptance criteria 9-10.
- `next-action-panel.test.tsx`: acceptance criterion 11. Mock `@/lib/api` with `importOriginal`, as `health-badge.test.tsx` does. Mock `next/navigation`'s `notFound` if you test the 404 path.
- `interaction-timeline.test.tsx`: acceptance criterion 13.
- `interaction-form.test.tsx`: acceptance criterion 12. Pass a fake `action` prop (`vi.fn(async () => errorState)`), click submit inside `await act(async () => ...)`, then use `findByText`. If clicking does not trigger the form action in jsdom, use `fireEvent.submit(form)`.
- `deal-actions.test.ts` (`// @vitest-environment node`): acceptance criteria 17-21. Use `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))`, and mock `@/lib/api` with `importOriginal` so the real `ApiError` is kept.

### Function-level changes

**`api/src/scoring/rule-based-scorer.ts`**
- Add `function closeDateFactorName(daysUntilClose: number | null): "closeDate" | "closeDatePassed"`. It returns `"closeDatePassed"` when `daysUntilClose !== null && daysUntilClose < 0`.
- In `buildFactors`, build `{ name: closeDateFactorName(metrics.daysUntilClose), points: closeDatePoints(metrics.daysUntilClose) }`. The zero-point filter stays.
- In `factorPhrase`, add `case "closeDate": case "closeDatePassed": return closeDatePhrase(metrics.daysUntilClose ?? 0);`. The switch stays exhaustive and the reason strings do not change.

**`api/tests/unit/rule-based-scorer.test.ts`**
- Change the close-date `it.each` rows to `[offset, name, points]`: `[-1, "closeDatePassed", 25]`, `[0, "closeDate", 20]`, `[7, "closeDate", 20]`, `[8, "closeDate", 10]`, `[30, "closeDate", 10]`.
- Each row asserts `toContainEqual({ name, points })` and checks that the other close-date name is absent.
- Keep the 31-day and null cases.
- The "very old close date" test now expects `{ name: "closeDatePassed", points: 25 }`.

**`api/tests/integration/deals-priority.test.ts`**
- Add `it("marks an overdue deal with a closeDatePassed factor")`.
- Create a PROPOSAL deal with `closeInDays: -1` and call `GET /deals/:id/next-action`.
- Expect `factors` to contain `{ name: "closeDatePassed", points: 25 }` and no factor named `closeDate`.

**`web/src/lib/types.ts`** (add these and keep the header comment):
```ts
export const DEAL_STAGES = ["LEAD","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const INTERACTION_TYPES = ["EMAIL","CALL","MEETING","NOTE"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export interface Deal { id: string; companyId: string; title: string; value: number; stage: DealStage;
  expectedCloseDate: string | null; /* YYYY-MM-DD */ closedAt: string | null; createdAt: string; updatedAt: string; }
export interface DealWithCompany extends Deal { companyName: string }
export type PriorityFactorName = "daysSinceContact" | "closeDate" | "closeDatePassed" | "stage" | "value" | "AI adjustment from interaction notes";
export interface PriorityFactor { name: PriorityFactorName; points: number }
export type ScoredBy = "rules" | "llm";
export interface PriorityResult { score: number; reason: string; nextAction: string; factors: PriorityFactor[]; scoredBy: ScoredBy }
export interface PrioritizedDeal { deal: DealWithCompany; priority: PriorityResult }
export type DealNextAction = { dealId: string } & PriorityResult;
export interface Interaction { id: string; dealId: string; type: InteractionType; notes: string; occurredAt: string; createdAt: string; updatedAt: string }
export interface Company { id: string; name: string; industry: string | null; website: string | null; createdAt: string; updatedAt: string }
export interface ValidationIssue { path: (string | number)[]; message: string }
// Request bodies carry raw form strings: the API validates them.
export interface CreateInteractionBody { type: string; notes: string; occurredAt?: string }
export interface UpdateDealBody { stage: string }
export interface PageQuery { page: number; pageSize: number }
```

**`web/src/lib/api.ts`** (add, in the same style as `getHealth`):
- `export const DEAL_CLOSED = "DEAL_CLOSED";`
- `function pageQuery({ page, pageSize }: PageQuery): string` returns `?page=${page}&pageSize=${pageSize}`.
- `getPrioritizedDeals(query)` returns `Promise<Paginated<PrioritizedDeal>>`.
- `getDeal(id)` returns `Promise<Deal>`.
- `getDealNextAction(id)` returns `Promise<DealNextAction>`.
- `getCompany(id)` returns `Promise<Company>`.
- `getDealInteractions(dealId, query)` returns `Promise<Paginated<Interaction>>`.
- `createDealInteraction(dealId, body)` sends a `POST` and returns `Promise<Interaction>`.
- `updateDeal(id, body)` sends a `PATCH` and returns `Promise<Deal>`.
- Every id goes through `encodeURIComponent`.

**`web/src/lib/format.ts`**
- `formatValue(value: number): string` uses `Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })` with `d = Number.isInteger(value) ? 0 : 2`. Create the two formatters once, at module level.
- `formatDate(value: string): string`:
  - If `value` matches `/^\d{4}-\d{2}-\d{2}$/`, append `T00:00:00.000Z`.
  - Format with a module-level `Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })`.
  - Add a comment explaining D4.

**`web/src/lib/deal-display.ts`**
- `STAGE_LABELS: Record<DealStage, string>` and `stageBadgeVariant(stage): BadgeVariant`: WON gives success, LOST gives danger, everything else gives neutral.
- `INTERACTION_TYPE_LABELS: Record<InteractionType, string>`.
- `factorLabel(name: string): string`: looks the name up in a `Record<PriorityFactorName, string>` and falls back to the raw name.
- `formatPoints(points: number): string`: `+N` when positive, `-N` when negative, `0` for zero.
- `export const OVERDUE_FACTOR_NAME = "closeDatePassed";` and `isOverdue(factors: PriorityFactor[]): boolean`, implemented as `factors.some(f => f.name === OVERDUE_FACTOR_NAME)`. Comment: "The API decides what overdue means; this only reads its factor."
- `scoredByLook(scoredBy): { variant: BadgeVariant; text: string }`.

**`web/src/lib/pagination.ts`**
- `export const DEALS_PAGE_SIZE = 20;`
- `parsePageParam(value: string | string[] | undefined): number` returns `Number(value)` when `typeof value === "string" && /^[1-9]\d{0,5}$/.test(value)`, and 1 otherwise.

**`web/src/lib/form-state.ts`**
```ts
import type { ApiError } from "./api"; // type-only: no server-only code at runtime
export interface FormState<F extends string> {
  status: "idle" | "success" | "error";
  fieldErrors: Partial<Record<F, string>>;
  formError?: string;
  values?: Partial<Record<F, string>>;
}
export type InteractionField = "type" | "notes" | "occurredAt";
export type StageField = "stage";
export function initialFormState<F extends string>(): FormState<F>  // { status: "idle", fieldErrors: {} }
export function toFormErrors<F extends string>(error: ApiError, fields: readonly F[]): Pick<FormState<F>, "fieldErrors" | "formError">
```
- `toFormErrors` rules:
  - Status 400 with array `details`: each issue whose `path[0]` is in `fields` sets `fieldErrors[path[0]]`, keeping only the first message per field. The remaining issues are joined into `formError`. If no issue maps to a field and nothing remains, `formError = error.message`.
  - Status 0: `API_NOT_RUNNING_MESSAGE`.
  - 404: "This deal no longer exists."
  - Anything else: "Could not save. Please try again."
- Client components import only the types from this module, plus `initialFormState`.

**`web/src/lib/load.ts`** (`import "server-only"`)
```ts
export type LoadResult<T> = { status: "ok"; data: T } | { status: "unreachable" };
// By-id lookups: 404 or 400 VALIDATION_ERROR (non-UUID id) -> notFound(); status 0 -> unreachable; anything else rethrown.
export async function loadResource<T>(request: Promise<T>): Promise<LoadResult<T>>
// Lists: status 0 -> unreachable; anything else rethrown.
export async function loadCollection<T>(request: Promise<T>): Promise<LoadResult<T>>
```
`notFound()` is called inside `catch`. It throws its own control-flow error, and nothing swallows it.

**`web/src/components/deals/prioritized-deals.tsx`**
- `async function PrioritizedDeals({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })`:
  1. `const page = parsePageParam((await searchParams).page)`.
  2. `const result = await loadCollection(getPrioritizedDeals({ page, pageSize: DEALS_PAGE_SIZE }))`. If unreachable, return `<ApiUnavailable/>`.
  3. Render the empty states (requirement 12), or `<DealsTable items meta/>` plus `<Pagination page pageSize total basePath="/deals"/>`.

**`web/src/components/deals/deals-table.tsx`**
- `DealsTable({ items: PrioritizedDeal[]; meta: PaginationMeta })`.
- Uses the Table parts, `TextLink`, `StageBadge`, `OverdueBadge`, `ScoreBar`, `formatValue` and `formatDate`. No fetching.
- Put each row in a `DealRow` subcomponent to keep functions small.

**`web/src/components/ui/pagination.tsx`**
- `Pagination({ page, pageSize, total, basePath })`.
- Returns null when `total <= pageSize && page === 1`.
- Renders `<nav aria-label="Pagination">` with the range text, where `from = (page-1)*pageSize + 1` and `to = min(page*pageSize, total)`.
- Enabled controls are `ButtonLink variant="secondary" size="sm" href={`${basePath}?page=N`}`.
- Disabled controls are `<Button variant="secondary" size="sm" disabled>`, so they are not links and cannot be focused.

**`web/src/components/deals/deal-view.tsx`**
- `async function DealView({ params }: { params: Promise<{ id: string }> })`:
  1. `const { id } = await params`.
  2. `const deal = await loadResource(getDeal(id))`. If unreachable, return `<ApiUnavailable/>`.
  3. `const [company, interactions] = await Promise.all([loadResource(getCompany(deal.companyId)), loadResource(getDealInteractions(id, { page: 1, pageSize: 100 }))])`. If either is unreachable, return `<ApiUnavailable/>`.
  4. Layout: a grid with gap, two columns on `lg`.
     - `PageHeader` (title, company link, "All deals" link).
     - Left column: `DealDetailsCard`, then a Card "Interactions" containing `InteractionForm action={addInteraction.bind(null, id)}` and `InteractionTimeline`.
     - Right column: a Card with `StageForm key={deal.stage} stage={deal.stage} action={updateDealStage.bind(null, id)}`, then `<Suspense fallback={<NextActionSkeleton/>}><NextActionPanel dealId={id}/></Suspense>`.
  5. `key={deal.stage}` remounts the stage form after a successful change, so the select shows the new stage.

**`web/src/components/deals/next-action-panel.tsx`**
- A helper `fetchNextAction(dealId): Promise<DealNextAction | "closed" | "unreachable">` maps:
  - `ApiError` with `code === DEAL_CLOSED` to `"closed"`;
  - status 0 to `"unreachable"`;
  - 404 to `notFound()`;
  - anything else is rethrown.
- `async function NextActionPanel({ dealId })` renders `<ClosedDealNotice/>`, `<ApiUnavailable/>` or `<NextActionCard result={result}/>`.

**`web/src/components/deals/next-action-card.tsx`**: a `Card` with:
- a `CardTitle` "Next action" with `ScoredByBadge` and `OverdueBadge factors={result.factors}` beside it;
- `nextAction` in `text-foreground`;
- `ScoreBar` with `label="Priority score"`;
- a `CardDescription` with the reason;
- `FactorsList`.

**`web/src/components/deals/factors-list.tsx`**
- `<ul aria-label="Scoring factors">`. Each `<li>` is a flex row: label on the left, `formatPoints` on the right (`tabular-nums`).
- Empty factors: `<p className="text-sm text-muted">No scoring factors</p>`. Token text colors are fine in feature components; the existing `app/page.tsx` does the same.

**`web/src/components/deals/interaction-form.tsx`** (`"use client"`)
- Props: `{ action: (state: FormState<InteractionField>, formData: FormData) => Promise<FormState<InteractionField>> }`.
- `const [state, formAction, pending] = useActionState(action, initialFormState<InteractionField>())`.
- `<form action={formAction} noValidate>` with:
  - fields named `type`, `notes` and `occurredAt`;
  - ids `interaction-type`, `interaction-notes` and `interaction-date`;
  - error ids `interaction-type-error`, `interaction-notes-error` and `interaction-date-error`.
- Use `defaultValue={state.values?.X}` so values survive an error. React 19 resets uncontrolled forms after an action. On success `values` is undefined, so the fields clear.
- `aria-invalid` and `aria-describedby` are set only when that field has an error.
- `<FormError message={state.formError}/>` shows form-level errors.
- Optional: a `role="status"` "Interaction added." message on success.

**`web/src/components/deals/stage-form.tsx`** (`"use client"`)
- Same pattern as the interaction form, with field `stage` and options from `DEAL_STAGES` and `STAGE_LABELS`.
- Ids: `deal-stage` and `deal-stage-error`.

**`web/src/app/deals/[id]/actions.ts`** (`"use server"`)
```ts
export async function addInteraction(dealId: string, _prev: FormState<InteractionField>, formData: FormData): Promise<FormState<InteractionField>>
export async function updateDealStage(dealId: string, _prev: FormState<StageField>, formData: FormData): Promise<FormState<StageField>>
```
- Non-exported helpers:
  - `text(formData, name): string` returns `typeof v === "string" ? v : ""`.
  - `toOccurredAt(date: string): string | undefined`: an empty string gives undefined, `YYYY-MM-DD` gives `${date}T00:00:00.000Z`, and anything else passes through unchanged (the API reports it).
  - `revalidateDeal(dealId)` calls `revalidatePath(`/deals/${dealId}`)` and `revalidatePath("/deals")`.
- Build the body with a conditional spread, so `occurredAt` is absent when undefined.
- On success: `revalidateDeal(dealId)`, then return `{ status: "success", fieldErrors: {} }`.
- Catch `ApiError` and return `{ status: "error", ...toFormErrors(e, FIELDS), values }`. Rethrow anything else.

**`web/src/components/api-unavailable.tsx`**: `<div role="alert"><EmptyState title="Cannot reach the API" description={API_NOT_RUNNING_MESSAGE} /></div>`.

### Data flow

```
/deals?page=N
  page.tsx (static shell: PageHeader)
    Suspense -> PrioritizedDeals (awaits searchParams -> parsePageParam)
      -> lib/api.getPrioritizedDeals -> GET /deals/prioritized?page=N&pageSize=20
      -> DealsTable(items, meta) + Pagination(meta)
         overdue = isOverdue(item.priority.factors)   // reads the API's factor name

/deals/[id]
  page.tsx (static shell)
    Suspense -> DealView (awaits params)
      getDeal(id) -> [getCompany(companyId), getDealInteractions(id, 1, 100)] in parallel
      -> PageHeader, DealDetailsCard, StageForm(action=updateDealStage.bind(id)),
         InteractionForm(action=addInteraction.bind(id)), InteractionTimeline
      Suspense -> NextActionPanel -> getDealNextAction(id)
                    200 -> NextActionCard (ScoredByBadge, OverdueBadge, ScoreBar, FactorsList)
                    409 DEAL_CLOSED -> ClosedDealNotice

Form submit (browser) -> Server Action (server) -> lib/api POST/PATCH
  ok  -> revalidatePath("/deals/id"), revalidatePath("/deals") -> router re-renders the page with fresh data
  400 -> { fieldErrors from details[].path[0], values } -> useActionState shows them under the fields
```
There are no new API endpoints. The only API change is one new factor name value.

### Sequencing

1. API: change the scorer, then the unit and integration tests. Run `npm --prefix api run lint`, `typecheck` and `test`.
2. Web lib, with unit tests:
   - `types.ts`
   - `api.ts` (plus api tests)
   - `messages.ts` (and update `health-badge.tsx`)
   - `format.ts`, `deal-display.ts`, `pagination.ts`, `form-state.ts`, `load.ts`
3. UI primitives: `skeleton.tsx`, `pagination.tsx`, `description-list.tsx`, and `FormError` in `field.tsx`.
4. List page, with tests: `StageBadge`, `OverdueBadge`, `DealsTable`, `ApiUnavailable`, `PrioritizedDeals`, the skeleton, then `app/deals/page.tsx`, `loading.tsx` and `error.tsx`.
5. Detail page, with tests:
   - presentational components (`FactorsList`, `ScoredByBadge`, `NextActionCard`, `ClosedDealNotice`, `InteractionTimeline`, `DealDetailsCard`);
   - `NextActionPanel`;
   - `actions.ts`;
   - `InteractionForm` and `StageForm`;
   - `DealView`;
   - the route files.
6. Run `npm --prefix web run lint`, `typecheck`, `test` and `build`. Check both pages by hand in the light and dark themes, using only the keyboard.

### Conventions to follow

- Read these Next.js 16 docs before writing route and action code:
  - `web/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` (Server Functions, `"use server"`, forms, `useActionState`, refresh/revalidate)
  - `web/node_modules/next/dist/docs/01-app/02-guides/forms.md` (validation errors with `useActionState`)
  - `web/node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (sequential dispatch, binding arguments, what a `"use server"` file may export)
  - `web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` and `.../04-functions/refresh.md`
  - `web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` (inside Suspense the status stays 200, which is accepted) and `.../03-file-conventions/not-found.md`
  - `web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` (props `error: unknown` and `retry`; messages are redacted in production)
  - `web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` (status codes, Cache Components)
  - `web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` ("With Cache Components": param access must happen inside Suspense) and `.../03-file-conventions/page.md` (`searchParams`, `PageProps`)
  - `web/node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` ("Maximizing the static shell")
  - `web/node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`
- No `"use cache"`: deal data is request-time and uncached.
- Server data comes only through `lib/api.ts`. Client Components (`InteractionForm`, `StageForm`) never import `lib/api.ts` or `lib/load.ts` at runtime. They import only types, `initialFormState` and `deal-display.ts`.
- Use only `components/ui` components plus layout utilities, and only token colors. `className` on ui components is for layout only. Keep components small, one per file.
- No `any`, TypeScript strict, explicit names. Test names describe behavior. Use `it.each` for table cases. Every test must be able to fail.
- No new dependencies.
- Do not touch `.claude/`. Do not run git commands that change history. Suggested commit: `feat: add deals list and deal detail pages to the web dashboard`.
- In `.pipeline/implementation.md`, explain D1-D5 in plain English.

## Open questions / assumptions

1. **Where the overdue badge goes on the detail page:** the factors come only from the next-action call. So the detail page shows the overdue badge inside the next-action panel, not in the details card. The details card would need a second fetch or would have to compare dates. Closed deals have no next action (409), so they never show overdue. That is intended: overdue only matters for open deals, and the API decides it.
2. **Whole-row click:** the title link is the row's link to the deal page. A clickable `<tr>` would need client JS and would hurt accessibility.
3. **The timeline is capped at 100 interactions** (the API's max pageSize), with a note when there are more. A paginated timeline is out of scope.
4. **No currency symbol on values,** because the data model has no currency.
5. **`notFound()` inside Suspense** keeps HTTP 200 (with noindex) while the not-found UI still renders, as the docs describe. Accepted for this dashboard.
6. **Scope of the API change (D2):** only the factor name changes. Points, reasons, prompt shape and ordering do not. The historical specs in `docs/pipeline-runs/*` are not updated.
7. **No navigation changes:** the sidebar and home page already link to `/deals`.
