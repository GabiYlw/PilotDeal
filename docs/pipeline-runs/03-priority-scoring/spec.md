# Spec: Deal priority scoring (rule-based)

## Task

Add deal priority scoring behind a `PriorityScorer` interface (Strategy pattern) with one implementation, `RuleBasedScorer`, driven by an injectable `Clock`. Expose it through `GET /deals/prioritized` (paginated, open deals only, sorted by score) and `GET /deals/:id/next-action`. Design for a later `LlmScorer` but do not build it.

## Requirements

### Types and interfaces

1. `api/src/shared/clock.ts` exports `interface Clock { now(): Date }` and `class SystemClock implements Clock` whose `now()` returns `new Date()`. This is the only file in the change that may call `new Date()` with no arguments or `Date.now()`.
2. `api/src/scoring/priority-scorer.ts` exports:
   - `interface PriorityScorer { score(context: DealContext): Promise<PriorityResult> }`
   - `interface DealContext { deal: ScoredDeal; companyName: string; interactionCount: number; recentInteractions: RecentInteraction[] }`
   - `interface ScoredDeal { id: string; title: string; value: number; stage: OpenDealStage; expectedCloseDate: string | null; createdAt: Date }` (`expectedCloseDate` is `YYYY-MM-DD`, same as `Deal`).
   - `interface RecentInteraction { type: InteractionType; notes: string; occurredAt: Date }`
   - `type PriorityFactorName = "daysSinceContact" | "closeDate" | "stage" | "value"`
   - `interface PriorityFactor { name: PriorityFactorName; points: number }`
   - `interface PriorityResult { score: number; reason: string; nextAction: string; factors: PriorityFactor[]; scoredBy: "rules" }`. `scoredBy` is typed as the literal `"rules"` for now. When the LLM scorer is added later it becomes `"rules" | "llm"`; do not add `"llm"` now.
3. `recentInteractions` holds at most 5 items, newest first (`occurredAt` desc, then `id` desc). `interactionCount` is the total number of interactions of the deal and can be greater than 5.
4. `api/src/scoring/rule-based-scorer.ts` exports `class RuleBasedScorer implements PriorityScorer` with `constructor(private readonly clock: Clock)`. It never calls `new Date()` with no arguments or `Date.now()`. It reads `this.clock.now()` exactly once per `score()` call.

### Day arithmetic (UTC, whole calendar days)

5. `utcDay(date: Date) = Math.floor(date.getTime() / 86_400_000)` gives the UTC calendar-day index. `today = utcDay(clock.now())`.
6. `daysSinceContact = max(0, today - utcDay(lastContact))`. `lastContact` is the latest `occurredAt` in `recentInteractions`, computed as a max rather than assumed from array order. When `recentInteractions` is empty, `lastContact` is `deal.createdAt`. A `lastContact` in the future gives 0 (clamped).
7. `daysUntilClose = utcDay(new Date(expectedCloseDate + "T00:00:00.000Z")) - today`. A negative value means the date is in the past. It is `null` when `expectedCloseDate` is `null`. Parsing a given string into a Date is allowed; only `new Date()` with no arguments and `Date.now()` are banned.
8. These are calendar-day differences in UTC, not elapsed 24-hour periods. An interaction at `2026-03-11T23:59:00Z` with now = `2026-03-15T00:01:00Z` counts as 4 days.

### Scoring rules (score = sum of points; range 10-100, no clamping)

9. Stage points: `LEAD` 5, `QUALIFIED` 10, `PROPOSAL` 20, `NEGOTIATION` 25.
10. Days since contact points: 0-3 => 0, 4-7 => 10, 8-14 => 20, 15-21 => 25, >= 22 => 30.
11. Close date points: `daysUntilClose < 0` => 25; `0..7` => 20; `8..30` => 10; `>= 31` or `null` => 0.
12. Value points: `value >= 50000` => 20; `>= 20000` => 15; `>= 5000` => 10; otherwise 5. Compare the number directly (values have at most 2 decimals).
13. `score` is an integer: the sum of the four rule points.
14. `factors` lists every rule with `points > 0`, always in this order: `daysSinceContact`, `closeDate`, `stage`, `value`. The names are exactly `"daysSinceContact"`, `"closeDate"`, `"stage"` and `"value"`. Stage and value always score more than 0, so `factors` always has 2 to 4 entries.

### reason

15. Pick the two factors with the most points. Ties follow the order `daysSinceContact` > `closeDate` > `stage` > `value`. Because `factors` is already in that order, a stable sort of `factors` by points desc handles ties. The higher-ranked phrase comes first.
16. Phrases:
    - `daysSinceContact`: `no contact for {n} days` (n = daysSinceContact)
    - `closeDate` with daysUntilClose < 0: `the expected close date passed {n} days ago` (n = -daysUntilClose)
    - `closeDate` with daysUntilClose 0..30: `the expected close date is in {n} days` (n = daysUntilClose)
    - `stage`: `the deal is in the {stage} stage` (stage lowercased, for example `negotiation`)
    - `value`: `the deal is worth {value}`, with `{value}` formatted as in requirement 17
17. Value formatting: `en-US` thousands grouping, no currency symbol. Integers have no decimals and non-integers have exactly 2. Use `new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })` with `d = Number.isInteger(value) ? 0 : 2`. Examples: `50000` -> `50,000`; `4999.99` -> `4,999.99`; `48500.5` -> `48,500.50`; `100` -> `100`; `0` -> `0`.
18. The sentence is `phrase1 + " and " + phrase2`, with the first character uppercased and `"."` appended. Example: `No contact for 23 days and the expected close date passed 6 days ago.`
19. Phrase templates are used literally, without singular forms (`1 days`, `in 0 days`). See Open questions.

### nextAction (first matching rule wins)

20. `daysUntilClose < 0` -> `Confirm a new close date or push for a decision with {companyName}.`
21. `daysSinceContact >= 15` -> `Follow up with {companyName}: no contact for {n} days.`
22. Otherwise by stage:
    - `LEAD`: `Schedule a discovery call to qualify the lead.`
    - `QUALIFIED`: `Prepare and send a proposal.`
    - `PROPOSAL`: `Follow up on the proposal and address open questions.`
    - `NEGOTIATION`: `Agree on final terms and close the deal.`

### Wiring

23. `createContainer(config: Config, overrides: ContainerOverrides = {})` with `export interface ContainerOverrides { clock?: Clock }`. It uses `overrides.clock ?? new SystemClock()`, builds `const priorityScorer: PriorityScorer = new RuleBasedScorer(clock)` and passes it to `DealService`. Existing `createContainer(config)` calls keep working unchanged.
24. `DealService` receives the scorer through its constructor, typed as the `PriorityScorer` interface: `new DealService(dealRepository, companyRepository, priorityScorer)`. Only `container.ts` imports `RuleBasedScorer`.

### Endpoints

25. `GET /deals/prioritized`
    - Query: `paginationQuerySchema` (`page` defaults to 1; `pageSize` defaults to 20, max 100; unknown keys ignored). Invalid query -> 400 `VALIDATION_ERROR`, message `Invalid query parameters`, with a `details` array.
    - Returns only deals whose stage is not `WON` or `LOST`.
    - Sort order: `priority.score` desc, then `deal.expectedCloseDate` asc with `null` last, then `deal.id` asc. Use plain string comparison for the date and the id.
    - Response 200: `{ data: Array<{ deal: DealWithCompany; priority: PriorityResult }>, meta: { page, pageSize, total } }`. `total` is the number of open deals. `DealWithCompany` has every `Deal` field (`id, companyId, title, value, stage, expectedCloseDate, closedAt, createdAt, updatedAt`) plus `companyName`.
    - A page past the end returns `data: []` with the correct `total`.
    - The route is registered before `/:id`, so `/deals/prioritized` is not treated as an invalid id.
26. `GET /deals/:id/next-action`
    - `id` is validated with `idParamsSchema` (UUID). Invalid id -> 400 `{ error: { code: "VALIDATION_ERROR", message: "Invalid route parameters", details: [...] } }`.
    - Missing deal -> 404 `{ error: { code: "NOT_FOUND", message: "Deal {id} not found" } }`.
    - Deal in `WON` or `LOST` -> 409 `{ error: { code: "DEAL_CLOSED", message: "Deal {id} is closed ({stage})" } }`, for example `Deal 1234... is closed (WON)`. No `details`.
    - Success 200: `{ dealId, score, reason, nextAction, factors, scoredBy }`.
27. Loading: each endpoint loads deals with their company name, interaction count and 5 most recent interactions in one Prisma `findMany`/`findUnique` call with nested `include`/`select`. No per-deal queries (no N+1). Scoring and sorting all open deals in memory before paginating is acceptable at this scale, and this limitation must be documented in `.pipeline/implementation.md`.

## Acceptance criteria

Unit tests use a fixed clock with `NOW = 2026-03-15T12:00:00.000Z` (today = 2026-03-15) and the company name `Acme`.

1. `RuleBasedScorer` stage points are LEAD 5, QUALIFIED 10, PROPOSAL 20, NEGOTIATION 25 (table test).
2. Days since contact boundaries (table test), with the latest interaction `occurredAt` = today minus N days:
   3 -> 0 (no factor), 4 -> 10, 7 -> 10, 8 -> 20, 14 -> 20, 15 -> 25, 21 -> 25, 22 -> 30.
3. With no interactions, days since contact is measured from `deal.createdAt`: createdAt 10 days ago -> 20 points; createdAt today -> 0.
4. The latest `occurredAt` is used even when `recentInteractions` is not sorted: `[10 days ago, 2 days ago]` -> 0 points.
5. A future `occurredAt` or `createdAt` gives 0 days-since-contact points and does not throw.
6. Calendar-day semantics: an interaction at `2026-03-11T23:59:00Z` with now `2026-03-15T00:01:00Z` -> daysSinceContact 4 -> 10 points.
7. Close date boundaries (table test), with expectedCloseDate = today + N: -1 -> 25, 0 -> 20, +7 -> 20, +8 -> 10, +30 -> 10, +31 -> 0 (no factor); `null` -> 0 (no factor).
8. Value boundaries (table test): 4999.99 -> 5, 5000 -> 10, 19999.99 -> 10, 20000 -> 15, 49999.99 -> 15, 50000 -> 20; 0 -> 5.
9. `score` equals the sum of the factor points. Minimum case (LEAD, 0 days, no close date, value 0) -> 10. Maximum case (NEGOTIATION, >= 22 days, past close date, value >= 50000) -> 100.
10. `factors` contains only rules with more than 0 points, in the order daysSinceContact, closeDate, stage, value, with the exact names. `scoredBy` is `"rules"`.
11. reason: a deal with 23 days since contact and a close date 6 days ago (stage LEAD, value 100) -> `No contact for 23 days and the expected close date passed 6 days ago.`
12. reason tie between daysSinceContact (25 points, 15 days) and closeDate (25 points, past) -> the daysSinceContact phrase comes first.
13. reason tie between closeDate (25 points, 1 day ago) and stage NEGOTIATION (25 points), with 0 days since contact -> close date phrase first, stage second: `The expected close date passed 1 days ago and the deal is in the negotiation stage.`
14. reason tie between stage PROPOSAL (20) and value 50000 (20), with no contact factor and no close date -> `The deal is in the proposal stage and the deal is worth 50,000.`
15. reason uses `the expected close date is in {n} days` for close dates from today to +30. For example, +5 with NEGOTIATION and no contact factor -> `The deal is in the negotiation stage and the expected close date is in 5 days.`
16. Value formatting in reason: 48500.5 -> `48,500.50`; 50000 -> `50,000`; 1234567.89 -> `1,234,567.89`.
17. nextAction rule 1: close date passed -> `Confirm a new close date or push for a decision with Acme.`
18. nextAction rule 1 wins over rule 2: close date passed and 30 days without contact -> rule 1 text.
19. nextAction rule 2: 15 days without contact, close date not passed -> `Follow up with Acme: no contact for 15 days.`; 14 days -> the stage text.
20. nextAction rule 2 wins over rule 3: the stage text is not used when days >= 15.
21. nextAction rule 3: table test covering each of the 4 open stages with the exact texts.
22. `RuleBasedScorer` uses `clock.now()`, not the system time: with `vi.setSystemTime` set far from the fixed clock, results still follow the fixed clock.
23. `DealService.listPrioritized` (unit, mocked repository and mocked scorer) sorts by score desc, then expectedCloseDate asc with null last, then id asc. It paginates with `meta.total` equal to the number of candidates. It passes the scorer a `DealContext` with the correct `companyName`, `interactionCount` and `recentInteractions`.
24. `DealService.getNextAction` (unit): throws `NotFoundError` (404) when the repository returns null. Throws `DealClosedError` (409, code `DEAL_CLOSED`) for WON and for LOST (table test). The scorer is not called in either case. On success it returns `{ dealId, ...result }`.
25. Integration (`createContainer(config, { clock: { now: () => NOW } })`): `GET /deals/prioritized` returns open deals ordered by score desc. Equal scores are ordered by expectedCloseDate asc with nulls last. Equal score and equal date are ordered by id asc.
26. Integration: WON and LOST deals do not appear in `data` and are not counted in `meta.total`.
27. Integration: pagination (`page=1&pageSize=2`, `page=2&pageSize=2`) returns consecutive slices of the full sorted list with `meta` `{ page, pageSize, total }`. A page past the end returns `data: []` with the correct total. `pageSize=101` -> 400 `VALIDATION_ERROR`.
28. Integration: each item has the shape `{ deal, priority }`. `deal` has exactly the keys `id, companyId, title, value, stage, expectedCloseDate, closedAt, createdAt, updatedAt, companyName`, and `deal.value` is a number. `priority` has `score, reason, nextAction, factors, scoredBy`.
29. Integration: a deal with 6 interactions is scored from its latest interaction (the most recent in time), so loading only 5 does not change the result.
30. Integration: on an empty database, `GET /deals/prioritized` returns 200 (not the 400 from the `/:id` route) and `{ data: [], meta: { page: 1, pageSize: 20, total: 0 } }`.
31. Integration: `GET /deals/:id/next-action` returns 200 with `{ dealId, score, reason, nextAction, factors, scoredBy: "rules" }` and the exact expected values for a known deal under the fixed clock.
32. Integration: `GET /deals/:id/next-action` returns 404 `NOT_FOUND` with message `Deal {id} not found` for a random UUID, 409 `DEAL_CLOSED` for a WON deal and for a LOST deal, and 400 `VALIDATION_ERROR` for `not-a-uuid`.
33. Existing tests still pass. The only change to them is the mechanical `DealService` constructor update in `tests/unit/deals.service.test.ts`. `npm --prefix api run lint`, `npm --prefix api run typecheck` and `npm --prefix api test` pass.

## Edge cases

- **No interactions**: fall back to `deal.createdAt`. `interactionCount` is 0 and `recentInteractions` is `[]`.
- **More than 5 interactions**: only 5 are loaded, but they are the newest 5, so the latest `occurredAt` is always included.
- **Equal `occurredAt`**: use `id` desc as a secondary sort key so the loaded set is deterministic.
- **Future `occurredAt`/`createdAt`** (possible with a fixed past clock in tests, or with seed data): clamp daysSinceContact to 0.
- **Close date today**: daysUntilClose = 0 -> 20 points, phrase `is in 0 days`, not "passed".
- **Close date far in the past** (for example 1900-01-01): 25 points and a large n. No overflow issues.
- **`expectedCloseDate` null**: 0 points, not a factor, never treated as "passed" for nextAction.
- **Value 0**: 5 points. For LEAD (5) with value 0 (5) and no other factors, the tie goes to stage first: `The deal is in the lead stage and the deal is worth 0.`
- **Only two factors** (stage and value): the reason uses both.
- **Time of day near midnight UTC**: calendar-day semantics (requirement 8). The machine's local timezone has no effect because only `getTime()` arithmetic is used. Do not use `getDate()`/`setHours()`.
- **Closed deals**: excluded from the list in the query itself (`stage: { notIn: ["WON", "LOST"] }`). next-action returns 409 without calling the scorer.
- **Unknown query keys** on `/deals/prioritized`: ignored (non-strict schema, same as the other lists). `stage` and `companyId` filters are not supported here and are ignored too.
- **Route collision**: `/deals/prioritized` must match before `/deals/:id`. `/deals/:id/next-action` cannot collide with the `/deals/:dealId/interactions` mount because the paths differ.
- **Scorer failure**: if `score()` rejects, the error reaches the error middleware (500). The rule-based scorer needs no fallback.
- **Concurrency**: both endpoints are read-only, so a deal deleted between loading and responding causes no problem. A deal closed after the list query is not re-checked (snapshot semantics).
- **Empty database / page past the end**: `data: []` with the correct `total`.

## Implementation plan

### Files to touch

| File | Reason |
|------|--------|
| `api/src/shared/clock.ts` (new) | `Clock` interface and `SystemClock` |
| `api/src/shared/errors.ts` | Add `DealClosedError` (409, `DEAL_CLOSED`) |
| `api/src/scoring/priority-scorer.ts` (new) | `PriorityScorer` interface plus the context and result types |
| `api/src/scoring/rule-based-scorer.ts` (new) | `RuleBasedScorer` with the rules, reason and nextAction |
| `api/src/scoring/.gitkeep` | Optional: delete it, since the folder now has files |
| `api/src/modules/deals/deals.schemas.ts` | Types `OpenDealStage`, `ScoringCandidate`, `DealWithCompany`, `PrioritizedDeal`, `DealNextAction`, plus `isOpenStage` |
| `api/src/modules/deals/deals.repository.ts` | `listOpenForScoring()`, `findByIdForScoring(id)` |
| `api/src/modules/deals/deals.service.ts` | Inject `PriorityScorer`; add `listPrioritized` and `getNextAction` |
| `api/src/modules/deals/deals.controller.ts` | `listPrioritizedDeals` and `getNextAction` handlers |
| `api/src/modules/deals/deals.routes.ts` | Register `GET /prioritized` before `/:id`, and `GET /:id/next-action` |
| `api/src/container.ts` | `ContainerOverrides { clock? }`; wire `RuleBasedScorer` as `PriorityScorer` |
| `api/tests/unit/rule-based-scorer.test.ts` (new) | Rule boundaries, reason, nextAction |
| `api/tests/unit/deals.service.test.ts` | Constructor update (3rd argument), mocks for the 2 new repository methods, tests for `listPrioritized` and `getNextAction` |
| `api/tests/integration/deals-priority.test.ts` (new) | Endpoint tests with a fixed clock |
| `api/tests/integration/http.ts` | Add the new fields to the `ApiItem`/`ApiBody` superset types |
| `.pipeline/implementation.md` | Written by the coder. Must document the in-memory scoring limitation and the patterns used |

No Prisma schema change, no migration, no new env vars and no new dependencies.

### Function-level changes

**`api/src/shared/clock.ts`**
```ts
export interface Clock { now(): Date }
export class SystemClock implements Clock { now(): Date { return new Date(); } }
```

**`api/src/shared/errors.ts`**
- Add `export class DealClosedError extends AppError { readonly statusCode = 409; readonly code = "DEAL_CLOSED"; }` in the existing class style. The service passes the message. The error middleware needs no change because it already maps any `AppError`.

**`api/src/modules/deals/deals.schemas.ts`**
- `export const OPEN_DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;`
- `export type OpenDealStage = (typeof OPEN_DEAL_STAGES)[number];`
- `export function isOpenStage(stage: DealStage): stage is OpenDealStage`.
- `export interface ScoringInteraction { type: InteractionType; notes: string; occurredAt: Date }`, with `InteractionType` imported as a type from `../interactions/interactions.schemas.js`. Reusing `RecentInteraction` from scoring would also work, since the types match structurally. Preferred: the repository returns the deals module's own type and the service maps it to `DealContext`.
- `export interface ScoringCandidate { deal: Deal; companyName: string; interactionCount: number; recentInteractions: ScoringInteraction[] }`.
- `export type DealWithCompany = Deal & { companyName: string };`
- `export interface PrioritizedDeal { deal: DealWithCompany; priority: PriorityResult }` (type import from `../../scoring/priority-scorer.js`).
- `export type DealNextAction = { dealId: string } & PriorityResult;`

**`api/src/scoring/priority-scorer.ts`**
- Types exactly as in requirement 2. Import `OpenDealStage` from `../modules/deals/deals.schemas.js` and `InteractionType` from `../modules/interactions/interactions.schemas.js`, both with `import type` (required by `verbatimModuleSyntax`).
- Add a short comment that `score` is async because the planned `LlmScorer` will call the network.

**`api/src/scoring/rule-based-scorer.ts`**
- Module constants: `DAY_MS = 86_400_000`, `STAGE_POINTS: Record<OpenDealStage, number>`, `STAGE_ACTIONS: Record<OpenDealStage, string>`, `CONTACT_FOLLOW_UP_DAYS = 15`.
- Small pure functions. Keep them unexported unless a test needs them; prefer testing through `score()`:
  - `utcDay(date: Date): number`
  - `isoDateToUtcDay(isoDate: string): number`
  - `latestContact(context: DealContext): Date`: the max `occurredAt`, or `deal.createdAt`
  - `daysSinceContactPoints(days: number): number`
  - `closeDatePoints(daysUntilClose: number | null): number`
  - `valuePoints(value: number): number`
  - `formatValue(value: number): string`
  - `factorPhrase(name, metrics): string`, where metrics = `{ daysSinceContact, daysUntilClose, stage, value }`
  - `buildReason(factors, metrics): string`: stable-sort a copy by points desc (`toSorted` is available with lib es2023, or use `[...factors].sort`), take the first 2, map them to phrases, join with `" and "`, uppercase the first character and append `"."`. With `noUncheckedIndexedAccess`, avoid indexing with `!`; for example, map over `slice(0, 2)`.
  - `buildNextAction(metrics, companyName): string`, following requirements 20-22.
- `class RuleBasedScorer implements PriorityScorer`:
  - `constructor(private readonly clock: Clock) {}`
  - `score(context: DealContext): Promise<PriorityResult>`. Implement it as a **non-async** method that returns `Promise.resolve(result)`. The reason: `@typescript-eslint/require-await` (part of `recommendedTypeChecked`) rejects an `async` method with no `await`. The method computes the metrics once, builds the factor list in the fixed order, filters `points > 0` and sets `score = sum`, `reason`, `nextAction` and `scoredBy: "rules"`.

**`api/src/modules/deals/deals.repository.ts`**
- Add to the `DealRepository` interface:
  - `listOpenForScoring(): Promise<ScoringCandidate[]>`: every deal whose `stage` is not WON or LOST.
  - `findByIdForScoring(id: string): Promise<ScoringCandidate | null>`: any stage. The service decides on the 409.
- Implementation: define a shared include, `const scoringInclude = { company: { select: { name: true } }, interactions: { select: { type: true, notes: true, occurredAt: true }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 5 }, _count: { select: { interactions: true } } } satisfies Prisma.DealInclude`. Import the `Prisma` namespace type from `../../../generated/prisma/client.js`; if `satisfies` with the namespace is awkward, inline the include in both calls. Then run one `findMany({ where: { stage: { notIn: ["WON", "LOST"] } }, include: scoringInclude })` and one `findUnique({ where: { id }, include: scoringInclude })`. Map the rows with a `toScoringCandidate(row)` helper that reuses `toDeal(row)` for the deal fields and adds `row.company.name`, `row._count.interactions` and `row.interactions`. The list query needs no ordering because the service sorts.

**`api/src/modules/deals/deals.service.ts`**
- Constructor: add `private readonly priorityScorer: PriorityScorer` as the third parameter.
- `async listPrioritized(pagination: Pagination): Promise<Paginated<PrioritizedDeal>>`:
  1. `const candidates = await this.dealRepository.listOpenForScoring();`
  2. Score them with `Promise.all(candidates.map(...))` into `PrioritizedDeal` items (`deal: { ...candidate.deal, companyName }`, `priority`). As a defensive check, skip candidates whose stage is not open; `isOpenStage` also narrows the type for the context.
  3. Sort with a module function `comparePrioritized`: score desc; expectedCloseDate asc, null last; id asc. Plain `<`/`>` is enough, no `localeCompare`.
  4. Slice with `toSkipTake(pagination)` (from `skip` to `skip + take`) and return `toPaginated({ items, total: sorted.length }, pagination)`.
- `async getNextAction(id: string): Promise<DealNextAction>`:
  1. Call `findByIdForScoring(id)`. If it returns null, throw `dealNotFound(id)` (existing helper).
  2. If `!isOpenStage(candidate.deal.stage)`, throw `new DealClosedError(\`Deal ${id} is closed (${candidate.deal.stage})\`)`.
  3. `const result = await this.priorityScorer.score(toDealContext(candidate, stage));`, then return `{ dealId: id, ...result }`.
- Module function `toDealContext(candidate: ScoringCandidate, stage: OpenDealStage): DealContext` picks `id, title, value, stage, expectedCloseDate, createdAt`. Do not pass `companyId`, `closedAt` or `updatedAt` to the scorer.
- You may keep the existing `CLOSED_STAGES`/`isClosedStage` and add `isOpenStage` from schemas; replace them only if that stays simple. Leave the existing `new Date()` for `closedAt` as is (out of scope).

**`api/src/modules/deals/deals.controller.ts`**
- `listPrioritizedDeals = async (req, res)`: parse `paginationQuerySchema` from `req.query` (`INVALID_QUERY_MESSAGE`), then `res.status(200).json(await this.dealService.listPrioritized(pagination))`.
- `getNextAction = async (req, res)`: parse `idParamsSchema` (`INVALID_PARAMS_MESSAGE`), then `res.status(200).json(await this.dealService.getNextAction(id))`.

**`api/src/modules/deals/deals.routes.ts`** (`createDealsRouter`)
```
router.get("/", controller.listDeals);
router.get("/prioritized", controller.listPrioritizedDeals);   // before "/:id"
router.get("/:id", controller.getDeal);
router.get("/:id/next-action", controller.getNextAction);
router.patch(...); router.delete(...);
```

**`api/src/container.ts`**
- `export interface ContainerOverrides { clock?: Clock }`
- `export function createContainer(config: Config, overrides: ContainerOverrides = {}): Container`
- `const clock: Clock = overrides.clock ?? new SystemClock();`
- `const priorityScorer: PriorityScorer = new RuleBasedScorer(clock);`, with a comment that `LlmScorer` will later be chosen here from config (`config.anthropicApiKey`).
- `new DealService(dealRepository, companyRepository, priorityScorer)`.

**`api/tests/integration/http.ts`**
- Add `export interface ApiPriority { score: number; reason: string; nextAction: string; factors: { name: string; points: number }[]; scoredBy: string }`.
- Add to `ApiItem`: `companyName: string`, `deal: ApiItem` (it already includes `companyName` once added) and `priority: ApiPriority`.
- Add to `ApiBody`: `score: number`, `reason: string`, `nextAction: string`, `factors: { name: string; points: number }[]`, `scoredBy: string`. `dealId` is already there.

### Tests

**`api/tests/unit/rule-based-scorer.test.ts`**
- `const NOW = new Date("2026-03-15T12:00:00.000Z"); const clock: Clock = { now: () => NOW };`
- A `context(overrides)` builder with these defaults: stage `LEAD`, value `100`, expectedCloseDate `null`, createdAt = NOW, no interactions, companyName `Acme`. The defaults give score 10 and factors `[stage 5, value 5]`.
- Helpers: `daysAgo(n)` = `new Date(NOW.getTime() - n * DAY)`; `isoDaysFromToday(n)` = `new Date(Date.UTC(2026, 2, 15 + n)).toISOString().slice(0, 10)`.
- `it.each` tables for acceptance criteria 1, 2, 7 and 8. Each row asserts only the rule under test (`factors.find(f => f.name === ...)?.points ?? 0`).
- Separate tests for criteria 3-6 and 9-22.

**`api/tests/unit/deals.service.test.ts`**
- Add `listOpenForScoring: vi.fn()` and `findByIdForScoring: vi.fn()` to `createDealRepository()`. In `setup()`, pass a mocked scorer `{ score: vi.fn() }` as the third constructor argument.
- Add `describe("listPrioritized")` and `describe("getNextAction")` blocks for criteria 23-24. The mocked scorer returns scores keyed by deal id, so the sorting and tie-break logic is tested independently of the rules.

**`api/tests/integration/deals-priority.test.ts`**
- Same boilerplate as `deals.test.ts`, but with `createContainer(config, { clock: { now: () => NOW } })` and `NOW = new Date("2026-03-15T12:00:00.000Z")`.
- Insert rows directly with `prisma`. **Always set `createdAt` explicitly** (relative to NOW) and `occurredAt` on interactions, because the database default (the real current time) is later than the fixed clock.
- Cover criteria 25-32. Write the hand-computed expected scores in comments (for example `NEGOTIATION 25 + 30 days 30 + passed 25 + 60000 20 = 100`).

### Data flow

```
GET /deals/prioritized?page&pageSize
  -> DealController.listPrioritizedDeals (zod pagination)
  -> DealService.listPrioritized
       -> DealRepository.listOpenForScoring()  (1 Prisma findMany with include: company.name, _count, top-5 interactions)
       -> ScoringCandidate[] -> DealContext (toDealContext) -> PriorityScorer.score() x N (Promise.all)
       -> PrioritizedDeal[] -> sort (score desc, close date asc nulls last, id asc) -> slice -> Paginated<PrioritizedDeal>
  -> 200 { data: [{ deal: {...Deal, companyName}, priority }], meta }

GET /deals/:id/next-action
  -> DealController.getNextAction (zod idParamsSchema)
  -> DealService.getNextAction
       -> DealRepository.findByIdForScoring(id) -> null => NotFoundError (404)
       -> closed stage => DealClosedError (409 DEAL_CLOSED)
       -> PriorityScorer.score(context)
  -> 200 { dealId, score, reason, nextAction, factors, scoredBy }

RuleBasedScorer: clock.now() -> today (UTC day index) -> metrics { daysSinceContact, daysUntilClose, stage, value }
  -> points per rule -> factors (fixed order, > 0) -> score, reason (top 2), nextAction
```

### Sequencing

1. `shared/clock.ts`, then `DealClosedError` in `shared/errors.ts`.
2. Types in `deals.schemas.ts` (`OpenDealStage`, `isOpenStage`, `ScoringInteraction`, `ScoringCandidate`, `DealWithCompany`) and in `scoring/priority-scorer.ts`. Add `PrioritizedDeal`/`DealNextAction` once the scorer types exist.
3. `scoring/rule-based-scorer.ts` and `tests/unit/rule-based-scorer.test.ts`; run the unit tests.
4. Repository methods (interface and Prisma implementation).
5. `DealService` constructor and methods, then update `tests/unit/deals.service.test.ts` (constructor, mocks, new tests).
6. `container.ts` overrides and wiring. Typecheck passes again from this step.
7. Controller handlers and routes.
8. `tests/integration/http.ts` types and `tests/integration/deals-priority.test.ts`.
9. Run lint, typecheck and all tests. Write `.pipeline/implementation.md`.

### Conventions to follow

- Layers: routes -> controller -> service -> repository -> Prisma. Only the repository touches Prisma. The controller parses input with `parseOrThrow` and calls exactly one service method.
- Constructor injection only. `RuleBasedScorer` and `SystemClock` are instantiated only in `container.ts`. `DealService` depends on the `PriorityScorer` interface, not on the class.
- ESM imports with the `.js` extension, and `import type` for type-only imports (`verbatimModuleSyntax`).
- No `any`, and no non-null assertions to get around `noUncheckedIndexedAccess`. Keep functions small with explicit names.
- `@typescript-eslint/require-await`: no `async` function without an `await` (see `RuleBasedScorer.score`).
- Errors use the `{ error: { code, message, details? } }` shape through typed `AppError` subclasses. Messages follow the existing `Deal ${id} not found` style.
- Tests: Vitest, `it.each` for boundary tables, names that describe behavior, a fixed clock, no real network. Integration tests do not repeat the rule boundaries covered by unit tests; they cover ordering, filtering, pagination, response shape and HTTP errors.
- Do not modify `.claude/`. No git commands that change history. Suggested commit: `feat: add rule-based deal priority scoring`.

## Open questions / assumptions

1. **"Days" semantics**: interpreted as UTC calendar-day differences (subtracting `floor(t / 86_400_000)` day indices), because the task stresses "UTC dates" and "today is the UTC date of clock.now()". Flooring elapsed time would make UTC irrelevant. The result is still "rounded down" because the day indices are floored.
2. **Future contact dates**: clamped to 0 days. The task does not define a negative "days since contact".
3. **Value format**: `en-US` thousands separators and no currency symbol (the model has no currency). Integers get 0 decimals, everything else exactly 2.
4. **Pluralization**: the task gives exact phrase templates and the tests assert exact strings, so the templates are used literally (`1 days`, `is in 0 days`). Singular forms or "today" can be polished later.
5. **Factor names**: `daysSinceContact`, `closeDate`, `stage`, `value`. The `factors` array follows the tie-break order and is not sorted by points.
6. **Tie-break on `id`**: ascending string comparison. The task says "then id". Existing lists use id desc, but only to break createdAt ties, which do not apply here.
7. **409 message**: `Deal {id} is closed ({stage})`, with no `details`. A dedicated `DealClosedError` class is used instead of a generic `ConflictError`, because `AppError.code` is a constant per class and the required code is `DEAL_CLOSED`.
8. **Where the logic lives**: in the existing `DealService`, `DealController` and deals router, not in a new module. This matches the CLAUDE.md example `new DealService(dealRepository, priorityScorer)` and keeps all `/deals` routes in one router.
9. **"Single query"**: implemented as one Prisma call with a nested `include` per endpoint. Prisma may run a fixed number of SQL statements for the relations (one per relation, not one per deal). With the default relation-load strategy, the nested `take: 5` may be applied after fetching all interactions of the open deals. Both are acceptable at this scale; note them in implementation.md next to the in-memory sorting limitation. A raw-SQL `LATERAL` join is the upgrade path if needed.
10. **Fixed clock in tests**: tests pass an object literal `{ now: () => NOW }`. No `FixedClock` class is added to `src`.
11. **`DealService.createForCompany`/`update` still use `new Date()` for `closedAt`**: left unchanged as out of scope. Moving them to `Clock` is a possible follow-up.
12. **`interactionCount` and interaction `notes`** are not used by `RuleBasedScorer`. They are in `DealContext` for the future `LlmScorer`.
