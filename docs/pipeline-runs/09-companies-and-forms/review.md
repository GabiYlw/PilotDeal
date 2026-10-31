# Review: companies pages, contacts, deal create/edit forms (web only) - re-review after fix cycle 1

> **Note:** Low findings 1 (AC 4 untested) and 3 (style nits) were fixed after this pipeline run, in the same commit. Finding 2 (manual browser check of themes and the half-typed date message) was not part of that follow-up. AC 4 is now covered by `web/tests/unit/companies-page.test.tsx`, which renders `CompaniesPage` with the list and notice mocked and checks that the header's "New company" link points to `/companies/new`. The stray blank line in `action-error-paths.test.ts` is gone, and `app/companies/new/actions.ts` now splits the error mapping into a `const errors = ...` line like its sibling actions. Web lint, typecheck, tests (51 files, 447 tests) and build pass.

### Summary

All four Medium findings and all five code-level Low findings from the previous review are fixed. Every change in the fix cycle touched tests, except for two small production cleanups (`MutedText`, and the `notFound` option in `addCompany`). The production code otherwise matches what was reviewed before: Server Actions call `redirect` outside `try/catch`, revalidate only on success, map field errors and keep the submitted values, use the 404 messages from the spec, and rethrow anything that is not an `ApiError`. Data is fetched on the server only, through `lib/api.ts`, inside `<Suspense>`. Pages are built from `components/ui/*` and design tokens. `api/` is unchanged. The test report shows web lint, typecheck, test (50 files, 446 tests) and build passing, and API lint, typecheck, unit and integration tests passing, with no failures. The only remaining gaps are Low: AC 4's header link has no test, and no manual check was done in a browser.

### Verification of previous findings

| Previous finding | Status |
|---|---|
| Medium 1: editDeal path-less issue test duplicated `form-state.test.ts` | Fixed. The block is gone from `web/tests/unit/action-error-paths.test.ts`. |
| Medium 2: rethrow case ran for 5 actions, 4 already covered | Fixed. Only `editContact` remains (`action-error-paths.test.ts:112-118`). Rethrow for the other actions is still tested in `company-actions.test.ts:160`, `contact-actions.test.ts:91`, `deal-create-edit-actions.test.ts:117` and `:182`. |
| Medium 3: addDeal unreachable row duplicated | Fixed. It is now tested only in `action-error-paths.test.ts:97`, and `deal-create-edit-actions.test.ts:107-115` is a single 404 `it`. |
| Medium 4: removeContact 500 duplicated | Fixed. Only the status-0 case remains (`action-error-paths.test.ts:120-129`). The 500 case stays in `contact-actions.test.ts:147`. |
| Low 1: contact-item "only the details that are set" could not fail | Fixed. `contact-item.test.tsx:31` asserts the summary has exactly 3 children. |
| Low 2: unused `result` param and `as never` casts | Fixed (`contact-item.test.tsx:18-21`, `vi.fn<ContactAction>`). |
| Low 3: redundant api.test 404 rows | Fixed. `deleteCompany` is the one representative row left (`api.test.ts:299`). |
| Low 4: duplicated `Missing` component | Fixed. `web/src/components/ui/muted-text.tsx` is used by `companies-table.tsx:29,36` and `company-details.tsx:54,61`. It uses the `text-muted` token, which fits the UI rule "add a small component to components/ui/". |
| Low 5: `addCompany` 404 would show the deal message | Fixed. `web/src/app/companies/new/actions.ts:31` passes `{ notFound: SAVE_FAILED_MESSAGE }`. |
| Low 6: no manual browser check | Still open. Only a human can do this (see Low 2 below). |

I also checked the remaining 500 rows in `action-error-paths.test.ts:98` for the save actions. They do not duplicate anything: the per-action files have no 500 case for `editCompany`, `addContact`, `editContact`, `addDeal` or `editDeal`.

### Findings

#### Critical
None

#### High
None

#### Medium
None

#### Low

1. `web/src/app/companies/page.tsx:16`: no test covers the "New company" `ButtonLink` in the header (AC 4). The only assertion on a "New company" link (`companies-list.test.tsx:62`) checks the empty-state link, which is a different element. I rate this Low and not blocking. The page is a thin, static Server Component. Reading the code shows `href="/companies/new"` with the label "New company", which matches the AC exactly. The spec's test plan did not ask for a page-level test, and CLAUDE.md does not require one for page shells. **Fix (optional):** add a small render test of `CompaniesPage` that asserts the header link's href, with `CompaniesList` and `CompanyDeletedNotice` mocked.
2. Not checked in a browser: light and dark themes, and the inline message for a half-typed date. Only a human can check these. On reading, only tokens are used, and the date inputs follow the existing `blockedBy` pattern. **Fix:** check both manually before committing.
3. Cosmetic: there is a stray blank line before the closing `});` of `describe.each` at `web/tests/unit/action-error-paths.test.ts:108`, and `web/src/app/companies/new/actions.ts:31` is a long line, while the sibling actions split it into a `const errors = ...` line (for example `companies/[id]/actions.ts:78-79`). Lint passes. **Fix (optional):** match the style of the sibling files.

### Spec adherence

| # | Criterion | Status |
|---|---|---|
| 1 | api.ts functions, methods/paths/bodies, DELETE 204 resolves to undefined, ids encoded | Met (`api.ts:141-194`; `api.test.ts:151-306`) |
| 2 | Companies table: headers, name links, external website link with target/rel, muted placeholder | Met (`companies-table.tsx`, `MutedText`) |
| 3 | Empty states, pagination, `?page=` parsing, pageSize 20 | Met (`companies-list.tsx`) |
| 4 | "New company" header link to `/companies/new` | Met in code (`app/companies/page.tsx:16`). No test, see Low 1. |
| 5 | Deleted notice for `?deleted=1`, `already` and any other value | Met |
| 6 | `addCompany`: null optionals (including whitespace-only), revalidate, redirect | Met |
| 7 | `addCompany`: 400 / 0 / 500 handling | Met |
| 8 | `editCompany` | Met |
| 9 | `removeCompany`: success / 404 / 500 / 0 | Met |
| 10 | `addContact` | Met |
| 11 | `editContact` | Met |
| 12 | `removeContact` | Met |
| 13 | `addDeal` | Met |
| 14 | Value conversion | Met (`form-data.ts:15-18`) |
| 15 | `editDeal` | Met (`deals/[id]/actions.ts:96-123`) |
| 16 | Non-ApiError errors rethrown | Met, tested once per action |
| 17 | Form field errors, aria attributes, kept values, form error, pending state | Met for all six forms |
| 18 | Stage select defaults to LEAD, lists all six stages, toggle and Cancel | Met |
| 19 | Deal edit prefill and "Deal saved." | Met |
| 20 | `DeleteCompanyButton` flow | Met |
| 21 | `DeleteContactButton` flow | Met |
| 22 | Edit/Cancel/save return focus to Edit | Met |
| 23 | Company view: notFound, unreachable state, pageSize 100 | Met |
| 24 | `/deals/[id]` "Edit deal" form above the stage form | Met (`deal-view.tsx:82-85`) |
| 25 | lint / typecheck / test / build pass | Met per test report (web 446 tests, API 444 unit + 435 integration, no failures) |

Architecture, UI and testing conventions: the change follows them. There is no duplicated coverage left, there are no new dependencies, `"use server"` files export only async functions, and client components import only types and bound actions.

### Verdict

Every finding from the previous review is resolved. There are no Critical, High or Medium findings, no open test failures, and every acceptance criterion is met in code. The missing test for AC 4's header link is a Low gap on a trivial static element whose code matches the criterion exactly. The manual theme and browser check is left to the human reviewer.

STATUS: PASS
