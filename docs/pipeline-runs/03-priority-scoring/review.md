> **Note:** Low findings 1 to 5 were fixed after this pipeline run, in the same commit.

# Review: rule-based deal priority scoring

### Summary
The change is correct and follows the spec closely. `RuleBasedScorer` gets the UTC calendar-day math, all four rule boundaries, the stable-sort tie-break for `reason`, value formatting and the `nextAction` order right. It reads `clock.now()` exactly once and never reads the system time. `DealService` depends only on the `PriorityScorer` interface, and `container.ts` is the only `src` file that creates `RuleBasedScorer`/`SystemClock`. The list sort (score desc, then close date asc with null last, then id asc) is correct. Each endpoint uses one Prisma call with a nested `include`, so there is no N+1. 404, 409 and 400 match the spec exactly. The tester reports lint, typecheck and 632/632 tests passing, and every acceptance criterion is covered. The remaining findings are all Low: one formatting slip in an existing line, a few weak or redundant test assertions, and some repeated pagination-validation coverage.

### Findings

#### Critical
None

#### High
None

#### Medium
None

#### Low
1. `api/src/modules/deals/deals.controller.ts:59`: `deleteDeal =async (...)` is missing a space after `=`. The diff touched this existing line by accident. Fix: restore `deleteDeal = async (req: Request, res: Response): Promise<void> => {`.
2. `api/tests/unit/rule-based-scorer.test.ts:105`: `expect(result.reason).not.toContain("-")` can never fail. A negative day count never reaches the reason (the factor only appears when points > 0) or `nextAction` (which needs >= 15). Removing the `Math.max(0, ...)` clamp would not change any output. The `toBeUndefined()` assertion on line 104 already covers AC5. Fix: drop the vacuous assertion, or replace it with something observable (for example `expect(result.score).toBe(10)`).
3. `api/tests/unit/deals.service.test.ts:599-601`: `rejects.toThrow(new NotFoundError(...))` compares only the message, so a different error class with the same message would also pass. AC24 asks for a `NotFoundError` (404). Fix: also assert `rejects.toBeInstanceOf(NotFoundError)`, as the existing `delete` test does, or check `{ statusCode: 404, code: "NOT_FOUND" }` with `toMatchObject`.
4. `api/tests/integration/deals-priority.test.ts:188`: the table covers `pageSize=101`, `page=0` and `pageSize=abc`. `paginationQuerySchema` is already tested heavily (`validation-edge-cases.test.ts:50`, `companies.test.ts:189-198`, `deals.test.ts:330`). CLAUDE.md says one representative case is enough when a rule is covered elsewhere. Fix: keep only `pageSize=101`, which is the one AC27 asks for.
5. `api/tests/integration/deals-race.test.ts:369,377` and `api/tests/unit/interactions.service.test.ts:28-29`: AC33 says the only change to existing tests is the constructor update in `deals.service.test.ts`. These two extra edits were needed for typecheck, are mechanical, and are documented in implementation.md, so this is accepted. Optional: the race tests never score, so they could pass a stub `{ score: vi.fn() }` instead of a real `RuleBasedScorer(new SystemClock())`. That would keep `RuleBasedScorer` imports out of unrelated tests.

### Spec adherence
- Requirements 1-4 (types, Clock, scorer constructor, one `now()` call): met. `priority-scorer.ts` matches requirement 2 exactly, including `scoredBy: "rules"`. `rule-based-scorer.ts` has no `new Date()` without arguments and no `Date.now()`. `clock.now()` is read once (`rule-based-scorer.ts:148`), and a test checks this.
- Requirements 5-8 (UTC day math): met. `utcDay` uses only `getTime()` floor. `latestContact` is a reduce over all interactions (a max, not array order) with a fallback to `createdAt`. The value is clamped with `Math.max(0, ...)`. `isoDateToUtcDay` parses `T00:00:00.000Z`.
- Requirements 9-14 (points, score, factor order): met. All boundaries are correct (`closeDatePoints` handles null and >= 31 first, then < 0, then <= 7). Factors are built in the fixed order and zero-point factors are filtered out.
- Requirements 15-19 (reason): met. Factors are stable-sorted on a copy, the first two are taken, phrases follow the templates literally, the first character is uppercased and a period is appended. `Intl.NumberFormat` uses the 0/2 decimals rule.
- Requirements 20-22 (nextAction): met, in the right priority order. A null close date is never treated as passed.
- Requirements 23-24 (wiring): met. `ContainerOverrides { clock? }` defaults to `SystemClock`. The scorer is typed as `PriorityScorer`. A comment marks where the future LlmScorer choice will go.
- Requirement 25 (`GET /deals/prioritized`): met. The route is registered before `/:id`. The query is validated with `paginationQuerySchema`. Only open stages are returned (`notIn` in the query plus a defensive guard). The comparator is correct. `total` is the number of open deals, and a page past the end gives `[]`.
- Requirement 26 (`GET /deals/:id/next-action`): met. UUID validation gives 400, a missing deal gives 404 `Deal {id} not found`, and a closed deal gives 409 `DEAL_CLOSED` `Deal {id} is closed ({stage})` without calling the scorer.
- Requirement 27 (loading, no N+1): met. One shared `scoringInclude` (company name, `_count`, the 5 newest interactions ordered by `occurredAt` desc then `id` desc) is used in a single `findMany`/`findUnique`. The in-memory sort limitation and the Prisma relation-load caveat are documented in implementation.md.
- Acceptance criteria 1-22: met. `rule-based-scorer.test.ts` uses `it.each` tables for AC1, 2, 3, 7, 8, 16 and 21, and has separate tests for the tie and priority cases. AC22 uses `vi.setSystemTime(2030)`, which would fail if the scorer used system time.
- Acceptance criteria 23-24: met. These tests would fail if the comparator, the slicing or the context mapping broke. The context check uses exact equality, so passing extra fields such as `companyId` would fail it. The WON/LOST cases are an `it.each` table.
- Acceptance criteria 25-32: met. The ordering fixture covers every tie-break, including a null date beating a smaller id (J before K), and is inserted in shuffled order. The 6-interaction test inserts the newest first, so it would fail if the interactions were ordered asc. The empty-database test checks 200 rather than the `/:id` 400. The next-action payload is checked for exact equality.
- Acceptance criterion 33: met (lint, typecheck and all tests pass per the test report). The extra mechanical test edits are noted in Low 5.

### Verdict
There are no Critical, High or Medium findings, no open test failures, and every acceptance criterion is met. The Low findings are a formatting fix and small test-quality improvements, and none of them affects correctness, security or the spec.

STATUS: PASS
