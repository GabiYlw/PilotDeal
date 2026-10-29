# Implementation: rule-based deal priority scoring

### Summary
Added a `PriorityScorer` interface (Strategy pattern) with one implementation, `RuleBasedScorer`, which reads "now" from an injected `Clock`. `DealService` gets the scorer through its constructor and exposes `listPrioritized` and `getNextAction`. Two new endpoints: `GET /deals/prioritized` (open deals only, paginated, sorted by score) and `GET /deals/:id/next-action`. `createContainer(config, overrides)` accepts an optional `clock` so tests can fix the time. No `LlmScorer`, no schema change, no migration, no new dependency, no new env var.

### Files changed
- `api/src/shared/clock.ts` (new): `Clock` interface and `SystemClock` (the only place that calls `new Date()` with no arguments).
- `api/src/shared/errors.ts`: added `DealClosedError` (409, `DEAL_CLOSED`).
- `api/src/scoring/priority-scorer.ts` (new): `PriorityScorer`, `DealContext`, `PriorityResult` and related types.
- `api/src/scoring/rule-based-scorer.ts` (new): the rules, `reason` and `nextAction` logic.
- `api/src/scoring/.gitkeep`: deleted (folder now has files).
- `api/src/modules/deals/deals.schemas.ts`: `OPEN_DEAL_STAGES`, `OpenDealStage`, `isOpenStage`, `ScoringInteraction`, `ScoringCandidate`, `DealWithCompany`, `PrioritizedDeal`, `DealNextAction`.
- `api/src/modules/deals/deals.repository.ts`: `listOpenForScoring()` and `findByIdForScoring()` using one shared Prisma `include`.
- `api/src/modules/deals/deals.service.ts`: scorer injected as 3rd constructor arg; `listPrioritized`, `getNextAction`, sort helpers, `toDealContext`.
- `api/src/modules/deals/deals.controller.ts`: `listPrioritizedDeals`, `getNextAction` handlers.
- `api/src/modules/deals/deals.routes.ts`: `GET /prioritized` (before `/:id`) and `GET /:id/next-action`.
- `api/src/container.ts`: `ContainerOverrides { clock? }`, `SystemClock` default, `RuleBasedScorer` wired as `PriorityScorer`.
- `api/tests/unit/deals.service.test.ts`, `api/tests/unit/interactions.service.test.ts`, `api/tests/integration/deals-race.test.ts`: mechanical updates only (new repository methods in the mocks, third `DealService` constructor argument). These were needed for typecheck to pass.

### Deviations from spec
- The spec's new tests (`rule-based-scorer.test.ts`, `deals-priority.test.ts`, new `listPrioritized`/`getNextAction` unit tests, `tests/integration/http.ts` type additions) were NOT written, per the coder rule that tests belong to the tester. The tester should write them from the acceptance criteria.
- Two extra existing test files needed the mechanical update (`interactions.service.test.ts` mock type, `deals-race.test.ts` constructor calls). The spec only listed `deals.service.test.ts`.
- `closeDatePhrase` takes a `number`; the caller passes `daysUntilClose ?? 0` because the closeDate factor only exists when a date exists. The `?? 0` is never reached for a real factor; it only satisfies the type checker without a non-null assertion.

### Notes for tester/reviewer
- Lint, typecheck and all existing API tests pass (19 files, 543 tests).
- Non-obvious decisions, in plain English:
  - **Strategy pattern:** `DealService` depends on the `PriorityScorer` interface only. Only `container.ts` knows `RuleBasedScorer`, so a later `LlmScorer` is a change in one place.
  - **Injectable clock:** the scorer never reads the system time. It asks `Clock.now()` once per call. Tests pass `{ now: () => NOW }` and need no fake timers.
  - **Calendar days, not 24-hour periods:** days are `floor(ms / 86_400_000)` differences in UTC, so 23:59 yesterday vs 00:01 today is 1 day. Only `getTime()` arithmetic is used, so the machine timezone does not matter.
  - **Latest contact is a max:** computed from the interactions rather than assumed from array position, so unsorted input is safe. Future dates clamp to 0 days.
  - **`score()` is not `async`:** it returns `Promise.resolve(...)` because the lint rule `require-await` rejects an `async` function with no `await`. The interface is async for the future network-based LLM scorer.
  - **Tie-breaks:** `factors` is built in the fixed tie-break order and `Array.sort` is stable, so sorting by points desc keeps ties in that order for `reason`.
  - **Sorting:** score desc, then close date asc with null last, then id asc, by plain string comparison (valid for `YYYY-MM-DD` and UUIDs).
  - **`DealClosedError`:** `AppError.code` is a constant per class, so a dedicated class is needed for the `DEAL_CLOSED` code. The error middleware already maps any `AppError`.
  - **Defensive open-stage check:** `isOpenStage` is also a type guard that narrows the stage for the scorer context. Closed deals in the list result would be skipped, though the query already excludes them.
- **Known limitation: in-memory scoring.** `GET /deals/prioritized` loads ALL open deals, scores every one, sorts them in memory, and only then slices the requested page. Cost grows linearly with the number of open deals, and `total` comes from the scored list. This is fine for a single-user CRM at this scale. If it becomes slow, push scoring into SQL or cache scores.
- **Caveat on "single query":** each endpoint makes one Prisma call (`findMany` or `findUnique`) with a nested `include`, so there is no per-deal N+1. Prisma may still run one SQL statement per relation (company, interactions, interaction count), a fixed number and not one per deal. With the default relation-load strategy, the nested `take: 5` may be applied after all interactions of the open deals were fetched, so the load is not strictly bounded to 5 rows per deal. The upgrade path is a raw-SQL `LATERAL` join in the repository.
- `DealService.createForCompany` and `update` still use `new Date()` for `closedAt`. This is out of scope and unchanged.
- Suggested commit: `feat: add rule-based deal priority scoring`
