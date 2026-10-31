# Test report (re-run after fix cycle 1)

### Summary

Framework: Vitest (web: jsdom + node env for actions, React Testing Library; API: Vitest + Supertest). No tests were added or changed in this run; duplicated coverage was not re-added.

| Command | Result |
|---|---|
| `npm --prefix web run lint` | pass (exit 0) |
| `npm --prefix web run typecheck` | pass (exit 0) |
| `npm --prefix web run test` | 50 files, 446 tests passed, 0 failed |
| `npm --prefix web run build` | pass (routes `/companies`, `/companies/[id]`, `/companies/new` present) |
| `npm --prefix api run lint` | pass |
| `npm --prefix api run typecheck` | pass |
| `npm --prefix api run test:unit` | 26 files, 444 tests passed |
| `npm --prefix api run test:integration` (db up, 5 migrations applied) | 15 files, 435 tests passed |

### Tests added

None in this run. The existing web tests from the coder and the earlier tester cycle stand. The fix cycle removed 9 duplicate cases (455 -> 446 tests) and tightened `contact-item.test.tsx`.

### Failures

None.

### Spec-coverage map

Coverage remains in the file that owns each behavior after the duplicate removals (rethrow for `editContact` stays in `action-error-paths.test.ts`; the other actions' rethrow, the `addDeal` unreachable case and the `removeContact` 500 are in the action test files).

| AC | Status | Where |
|---|---|---|
| 1 api.ts functions | Covered & passing | `api.test.ts` (`deleteCompany` 404 kept as the representative error row) |
| 2 companies table | Covered & passing | `companies-list.test.tsx` |
| 3 empty states, pagination, page param | Covered & passing | `companies-list.test.tsx` |
| 4 header "New company" link | Untested at the header (see below) | `app/companies/page.tsx:16` |
| 5 deleted notice | Covered & passing | `company-deleted.test.ts`, `company-deleted-notice.test.tsx` |
| 6, 7, 8, 9 company actions | Covered & passing | `company-actions.test.ts`, `action-error-paths.test.ts` |
| 10, 11, 12 contact actions | Covered & passing | `contact-actions.test.ts`, `action-error-paths.test.ts` |
| 13, 14, 15 deal actions, value conversion | Covered & passing | `deal-create-edit-actions.test.ts`, `form-data.test.ts`, `deal-value-validation.test.tsx` |
| 16 non-ApiError rethrown | Covered & passing | each action file; `editContact` in `action-error-paths.test.ts` |
| 17 form aria/errors/pending | Covered & passing | `company-form`, `contact-form`, `deal-create-form`, `deal-edit-form` tests |
| 18 stage select, toggle | Covered & passing | `deal-create-form.test.tsx`, `new-deal-panel.test.tsx` |
| 19 deal edit prefill, "Deal saved." | Covered & passing | `deal-edit-form.test.tsx` |
| 20 DeleteCompanyButton | Covered & passing | `delete-company-button.test.tsx` |
| 21 DeleteContactButton | Covered & passing | `delete-contact-button.test.tsx` |
| 22 edit/cancel/focus | Covered & passing | `contact-item.test.tsx`, `company-details.test.tsx` |
| 23 company view | Covered & passing | `company-view.test.tsx` |
| 24 deal page Edit deal form | Covered & passing | `deal-view.test.tsx` |
| 25 lint/typecheck/test/build | Covered & passing | results above |

Gaps to flag:
- AC 4: the "New company" link in the `/companies` page header (`app/companies/page.tsx`) has no test. The only "New company" link assertion (`companies-list.test.tsx:62`) is the empty-state link, which is a different element. The page file is a thin server component with a `ButtonLink href="/companies/new"`; the code matches the spec on reading, but it is not verified by a test. Adding a page-level test is optional and was not done here.
- Not verifiable by automated tests: light/dark theme appearance and the inline half-typed date message in a real browser. A human should check these.

### Regressions

None. All previously passing web and API tests pass (web 446, API unit 444, API integration 435).
