# Implementation: companies pages, contacts, deal create/edit forms (web only)

## Summary

Added the companies area of the dashboard (`/companies` list, `/companies/new`, `/companies/[id]` with company edit/delete, contacts CRUD and an inline "New deal" form) and an "Edit deal" form on `/deals/[id]`. Everything goes through Server Actions that call `lib/api.ts`. API validation errors appear next to their fields, and a 404 shows a clear message. The API was not touched.

## Files changed

Libs
- `web/src/lib/types.ts` - added `Contact`, `CompanyBody`, `ContactBody`, `CreateDealBody`; `UpdateDealBody` is now partial.
- `web/src/lib/api.ts` - added `getCompanies`, `createCompany`, `updateCompany`, `deleteCompany`, `getCompanyContacts`, `createCompanyContact`, `updateContact`, `deleteContact`, `getCompanyDeals`, `createCompanyDeal`; `companyPath`/`contactPath` helpers.
- `web/src/lib/form-state.ts` - `CompanyField`, `ContactField`, `DealField`, `DealEditField`.
- `web/src/lib/form-data.ts` (new) - `text`, `nullableText`, `toDealValue`.
- `web/src/lib/messages.ts` - `COMPANY_NOT_FOUND_MESSAGE`, `CONTACT_NOT_FOUND_MESSAGE`.
- `web/src/lib/company-deleted.ts` (new) - `?deleted=` outcome helpers (mirror of `deal-deleted.ts`).
- `web/src/lib/pagination.ts` - `COMPANIES_PAGE_SIZE`.

Server Actions
- `web/src/app/companies/new/actions.ts` (new) - `addCompany`.
- `web/src/app/companies/[id]/actions.ts` (new) - `editCompany`, `removeCompany`, `addContact`, `editContact`, `removeContact`, `addDeal`.
- `web/src/app/deals/[id]/actions.ts` - added `editDeal`; `text` now imported from `lib/form-data.ts`.

Routes (all new)
- `web/src/app/companies/page.tsx`, `loading.tsx`, `error.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/loading.tsx`.

Components (new, `web/src/components/companies/`)
- `companies-table.tsx`, `companies-list.tsx`, `companies-table-skeleton.tsx`, `company-detail-skeleton.tsx`, `company-deleted-notice.tsx`, `company-form.tsx`, `company-details.tsx`, `delete-company-button.tsx`, `company-view.tsx`, `contacts-section.tsx`, `contact-form.tsx`, `contact-item.tsx`, `delete-contact-button.tsx`, `company-deals-section.tsx`, `company-deals-table.tsx`, `new-deal-panel.tsx`, `deal-create-form.tsx`.

Components (deals)
- `web/src/components/deals/deal-edit-form.tsx` (new) - Title, Value, Expected close date form.
- `web/src/components/deals/deal-view.tsx` - "Edit deal" card above the stage form, bound to `editDeal`.

Tests (`web/tests/unit/`)
- Extended: `api.test.ts` (new endpoints, DELETE 204, 404s, id encoding for companies), `deal-view.test.tsx` (`editDeal` in mock, one assertion for the Edit deal form).
- New: `form-data.test.ts`, `company-deleted.test.ts`, `company-deleted-notice.test.tsx`, `company-actions.test.ts`, `contact-actions.test.ts`, `deal-create-edit-actions.test.ts`, `company-form.test.tsx`, `contact-form.test.tsx`, `deal-create-form.test.tsx`, `deal-edit-form.test.tsx`, `delete-company-button.test.tsx`, `delete-contact-button.test.tsx`, `contact-item.test.tsx`, `company-details.test.tsx`, `new-deal-panel.test.tsx`, `companies-list.test.tsx`, `company-view.test.tsx`.

## Deviations from spec

- Tests were written even though the coder role normally leaves them to the tester, because the spec's plan lists them explicitly and the task asked for lint/test/build to pass.
- No other deviations. The "None" placeholder was chosen for null industry/website in both the table and the details card (the spec left "-" or "None" open).
- `NewDealPanel` hides the "New deal" button while the form is open (spec allowed hidden or disabled); focus returns to it on Cancel.

## Notes for tester/reviewer

Non-obvious decisions (plain English):
- Helpers (`text`, `nullableText`, `toDealValue`) live in `lib/form-data.ts` because a `"use server"` file may only export async functions.
- Forms use the existing `useActionState` + `FormState` pattern. After an error the form is repopulated from `state.values`; after a success React's automatic form reset runs. For edit forms mounted only while editing, `defaultValue` falls back to the saved values, so each opening starts from fresh data.
- Edit forms always send every field (empty optional -> `null`), so a PATCH is never empty and emptying a field clears it.
- Redirects (`addCompany`, `removeCompany`, `addDeal`) are outside `try/catch` because `redirect` works by throwing. No action revalidates or redirects on an error, so a 404 never swaps the page to not-found mid-action.
- Company delete treats a 404 as "already deleted" and redirects to the list with a notice. Delete revalidates `/companies` and `/deals` because the cascade removes deals.
- `DealEditForm` is deliberately not keyed, so a stage update does not wipe a half-typed edit.
- Contact/deal actions are bound on the server (`actionsFor`, `.bind`) so client components never import the actions file.
- No new dependencies. No API changes. `.env.example` unchanged (no new variables).
- Manual UI check in a browser (light/dark themes) was not performed; only automated checks were run.

## Command results

- `npm --prefix web run lint`: pass
- `npm --prefix web run typecheck`: pass
- `npm --prefix web run test`: 48 files, 431 tests passed
- `npm --prefix web run build`: pass (`/companies`, `/companies/[id]`, `/companies/new` in the route table)
- `npm --prefix api run lint`: pass
- `npm --prefix api run typecheck`: pass
- `npm --prefix api run test:unit`: 26 files, 444 tests passed
- `npm --prefix api run test:integration` (db was running): 15 files, 435 tests passed

Suggested commit: `feat: add companies pages, contact management and deal create/edit forms`

## Fix cycle 1

Tests and small web cleanups only. No change to `api/`.

Medium findings (duplicated coverage):
1. `web/tests/unit/action-error-paths.test.ts`: deleted the "editDeal path-less issues" block (already covered by `form-state.test.ts`).
2. Same file: the non-ApiError rethrow case now runs only for `editContact`, the one action with no rethrow test elsewhere.
3. `web/tests/unit/deal-create-edit-actions.test.ts`: removed the `addDeal` unreachable-API row (kept in `action-error-paths.test.ts`) and turned the remaining 404 case into a plain `it`. Removed the two imports that became unused.
4. `action-error-paths.test.ts`: deleted the `removeContact` 500 case (covered in `contact-actions.test.ts`). The status-0 case stays. Updated the file header comment and dropped the unused `DELETE_FAILED_MESSAGE` import.

Low findings:
1. `contact-item.test.tsx`: the "only the details that are set" test now asserts the summary has exactly 3 children (name, role, email), so a phone row would fail it.
2. Same file: removed the unused `result` parameter and the `as never` casts. `edit` is `vi.fn<ContactAction>`.
3. `api.test.ts`: removed the `deleteContact` and `getCompanyContacts` 404 rows; `deleteCompany` stays as the representative one.
4. New `web/src/components/ui/muted-text.tsx` (`MutedText`, default text "None") replaces the duplicated `Missing` in `companies-table.tsx` and `company-details.tsx`.
5. `web/src/app/companies/new/actions.ts`: `toFormErrors` now gets `{ notFound: SAVE_FAILED_MESSAGE }`, so a 404 never shows the deal message.
6. Browser check of themes and half-typed date: not done by me. A human should check it.

Command results (web): lint clean, typecheck clean, test 50 files / 446 tests passed (was 455; the 9 fewer are the removed duplicates), build succeeded.
