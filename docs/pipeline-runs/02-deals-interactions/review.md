> **Note:** Low findings 1 to 3 were fixed after this pipeline run, in the same commit.

# Review: Deals and Interactions modules

### Summary
The change is correct, complete and follows the repo conventions. Both modules mirror the companies/contacts pattern exactly: routes -> controller -> service -> repository -> Prisma, constructor injection wired only in `container.ts`, zod validation in controllers (params, then query, then body), typed `NotFoundError`s, and repositories as the only Prisma touchpoint. The `closedAt` rule in `DealService` implements every transition in requirements 33-35. It never sends a `closedAt` key for no-stage, same-stage or open-to-open patches. A deal deleted between `findById` and `update` maps P2025 to null, which gives 404. Decimal goes to number via `.toNumber()`, and DATE goes to and from `YYYY-MM-DD` entirely in UTC. The tester confirmed this under two non-UTC time zones. The future `occurredAt` check runs `Date.now()` at parse time. Strict bodies reject `id`/`createdAt`/`updatedAt`/`companyId`/`closedAt`/`dealId`. The migration was generated and matches AC 1. The seed is idempotent: it deletes all companies, the cascade removes the children, and the data is rebuilt. Lint, typecheck and all 543 tests pass with no failures. The only findings are Low. The main one is that the seed (AC 28) was not run by the tester. Static review shows its data meets every AC 28 property.

### Findings

#### Critical
None

#### High
None

#### Medium
None

#### Low
- `api/tests/integration/deals.test.ts:61`: `expect(sql).toContain("DATE")` is a weak check. It also matches `ON UPDATE CASCADE`, so it would pass even if the `"expectedCloseDate" DATE` column were missing. Fix: assert on `/"expectedCloseDate" DATE\b/` (or `"expectedCloseDate" DATE,`).
- `api/prisma/seed.ts:13` and `:16`: `SeedStage` and the inline interaction-type union duplicate the Prisma enums. If an enum value is added or renamed later, the seed types will drift silently. Fix (optional): import `DealStage` / `InteractionType` from `../generated/prisma/client.js`, or `DEAL_STAGES` / `INTERACTION_TYPES` from the module schemas, and derive the types from them.
- `api/prisma/seed.ts:217` (`toDealCreate`): there is no explicit return type, so a typo in a nested field is only caught at the `prisma.company.create` call site. Fix (optional): annotate it with the Prisma `DealCreateWithoutCompanyInput` type.
- AC 28 (seed): the tester did not verify it because the dev DB was off-limits, and no automated test runs `seed.ts`. A static check of the data shows:
  - 8 deals and 26 interactions (4+2+3+4+2+5+3+3)
  - all six stages present
  - open deals 1, 5 and 8 have past `expectedCloseDate`s
  - 6 interactions at 5 days or less, and well over 5 older than 21 days
  - `closedAt` set only on the WON/LOST deals
  - idempotent through `deleteMany` plus the cascade

  The coder reports two runs with the expected counts. No code change is needed, but the human should run `npm --prefix api run seed` twice before committing.

### Spec adherence
| AC | Status |
|----|--------|
| 1 Migration (single folder, sorts after baseline, enums, DECIMAL(12,2), DATE, 2 cascade FKs, no vector, applied in test setup) | Met |
| 2 Create defaults | Met |
| 3 Trim, number value, date round trip (also under non-UTC TZ) | Met |
| 4 WON/LOST closedAt on create | Met |
| 5 Value boundaries (min/max/2-decimals regex on `String(value)`) | Met |
| 6 POST 400 matrix, 400 bad UUID, 404 missing company, no row created | Met |
| 7 200-char title, past leap day | Met |
| 8 Company deal list (filter, order, pagination, 400/404) | Met |
| 9 GET /deals filters, AND combination, filtered total, 400 cases, unknown keys ignored | Met |
| 10 GET /deals/:id shape, 404/400 | Met |
| 11 PATCH general (partial, null clears date, value 0) | Met |
| 12 closedAt transitions over HTTP | Met (all transitions, including LOST->WON and LOST->LOST) |
| 13 PATCH 400 matrix with stored row unchanged, 404 with and without stage | Met |
| 14 DELETE deal | Met |
| 15 Company cascade | Met |
| 16 Deal cascade | Met |
| 17 Create interaction (trim, default occurredAt) | Met |
| 18 occurredAt offset normalization | Met |
| 19 Interaction POST 400/404 matrix | Met |
| 20 Interaction list order (occurredAt desc, id desc, independent of createdAt), pagination | Met |
| 21 GET interaction | Met |
| 22 PATCH interaction | Met |
| 23 DELETE interaction | Met |
| 24 Race paths (repository FK null, mid-request deletes, stage PATCH read/update race) | Met (`deals-race.test.ts`) |
| 25 Error shape | Met |
| 26 Service unit tests (all closedAt transitions under fake timers, not-found and race paths) | Met |
| 27 Lint, typecheck, unit and integration tests | Met (543/543 passing, no regressions) |
| 28 Seed run twice | Met by static review and the coder's report. Not verified by the tester (see Low finding). |

Additional checks:
- Layering: services import only repository interfaces and schema types. Only repositories import `generated/prisma` and `prisma-errors`.
- Moving `companyIdParamsSchema` to `shared/validation.ts` is behavior-neutral.
- Router mount order puts nested routes before their parent prefixes.
- No new dependencies, no env changes, no embedding/AI/scoring code.
- `.claude/` is untouched.

### Verdict
No Critical, High or Medium findings, no open test failures, and every acceptance criterion is met. The seed was verified by static review rather than by the tester. The Low findings are optional hardening and do not block the merge.

STATUS: PASS
