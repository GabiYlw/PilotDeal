# Spec: Companies pages, create/edit flows, deal edit form (web only)

## Task

Build the web dashboard's companies pages (`/companies` list, `/companies/new` create form, `/companies/[id]` detail with company edit/delete, contacts CRUD and a "New deal" form), and add an Edit form for title, value and expected close date to `/deals/[id]`. The API stays as it is. Every flow uses Server Actions that call `web/src/lib/api.ts`, shows API field errors next to the fields, and shows a clear message on a 404.

## API contract (verified in `api/src`, do not change)

| Call | Method + path | Body (strict: unknown keys -> 400) | Success |
|---|---|---|---|
| List companies | `GET /companies?page&pageSize` (pageSize max 100, order createdAt desc) | - | 200 `Paginated<Company>` |
| Create company | `POST /companies` | `{ name: string (trim, 1..200), industry?: string(trim,1..100) \| null, website?: http(s) URL (max 2048) \| null }` | 201 `Company` |
| Get company | `GET /companies/:id` | - | 200 `Company` |
| Update company | `PATCH /companies/:id` | same fields, all optional, at least one key | 200 `Company` |
| Delete company | `DELETE /companies/:id` | - | 204 (cascades contacts, deals, interactions) |
| List company contacts | `GET /companies/:companyId/contacts?page&pageSize` (createdAt desc) | - | 200 `Paginated<Contact>`, 404 if company missing |
| Create contact | `POST /companies/:companyId/contacts` | `{ name (1..200), email?: email (max 320) \| null, phone?: text(1..50) \| null, role?: text(1..100) \| null }` | 201 `Contact`, 404 if company missing |
| Update contact | `PATCH /contacts/:id` | same fields, optional, at least one | 200 `Contact` |
| Delete contact | `DELETE /contacts/:id` | - | 204 |
| List company deals | `GET /companies/:companyId/deals?page&pageSize` (createdAt desc) | - | 200 `Paginated<Deal>` (no companyName), 404 if company missing |
| Create deal | `POST /companies/:companyId/deals` | `{ title (trim,1..200), value: number (0..9_999_999_999.99, max 2 decimals), stage?: enum (default LEAD), expectedCloseDate?: "YYYY-MM-DD" (>= 1900-01-01) \| null }` | 201 `Deal`, 404 if company missing |
| Update deal | `PATCH /deals/:id` | `{ title?, value?, stage?, expectedCloseDate? \| null }`, at least one | 200 `Deal` |

- Contact response: `{ id, companyId, name, email: string|null, phone: string|null, role: string|null, createdAt, updatedAt }`.
- Errors: `{ error: { code, message, details? } }`. 400 `VALIDATION_ERROR` with `details: { path: (string|number)[], message: string }[]` (message `"Invalid request body"`; a refine error such as "At least one field must be provided" has `path: []`). 404 `NOT_FOUND`. Non-UUID ids give 400 `VALIDATION_ERROR` on params (already treated as "missing" by `lib/load.ts`).
- Optional text fields reject `""` and whitespace-only strings (trim then min 1). `null` clears them. `value` must be a JSON number; a string gives a 400 at `path: ["value"]`.

## Requirements

1. `lib/api.ts` gains typed functions for every endpoint above that it does not already have (see Implementation plan). Ids are encoded with `encodeURIComponent`. `lib/types.ts` gains `Contact` and request body types; `UpdateDealBody` becomes partial (stage, title, value, expectedCloseDate all optional).
2. `/companies` shows a paginated table (20 per page, `?page=` param parsed with `parsePageParam`) with columns Name (link to `/companies/:id`), Industry, Website (external link opening in a new tab, or a muted placeholder when null). Empty states: no companies at all ("No companies yet" with a "New company" link), and a page beyond the last ("This page is empty" with "Back to the first page" link to `/companies`). API down -> `ApiUnavailable`.
3. `/companies` has a "New company" `ButtonLink` in the page header pointing to `/companies/new`.
4. `/companies/new` shows a form with Name (required), Industry (optional), Website (optional). Submitting calls `POST /companies`; on success it revalidates `/companies` and redirects (push) to `/companies/<new id>`.
5. `/companies/[id]` shows the company name as the page title, the industry as description (if any), an "All companies" link, and a "Delete company" button in the header. A missing or malformed id renders the not-found page. API down -> `ApiUnavailable`.
6. The company details card shows Industry, Website and Created date, with an "Edit" button. Edit swaps the card content for a form prefilled with the current values; Save calls `PATCH /companies/:id` with `{ name, industry, website }` (empty optional fields sent as `null`, which clears them). On success the form closes, focus returns to the Edit button, and the page shows the new values. Cancel closes without saving.
7. "Delete company" opens a `ConfirmDialog` titled "Delete company?" whose message names the company and states that all its contacts, deals and interactions are permanently deleted too. Confirming calls `DELETE /companies/:id`, revalidates `/companies` and `/deals`, and redirects (replace) to `/companies?deleted=1`, where a `Notice` says "Company deleted." with a "Dismiss" link to `/companies`. A 404 on delete redirects (replace) to `/companies?deleted=already` with "This company was already deleted.". Any other failure closes the dialog and shows the error under the button without redirecting.
8. Contacts section (Card titled "Contacts"): an add form (Name required, Email, Phone, Role optional) that calls `POST /companies/:companyId/contacts`; on success the fields clear and "Contact added." is shown; the list then contains the new contact. Below it, the contacts list (up to 100, newest first) showing name, role, email and phone (missing values omitted). Each contact has "Edit" (inline form, `PATCH /contacts/:id` with all four fields, empty optional -> `null`) and "Delete" (ConfirmDialog "Delete contact?" naming the contact, `DELETE /contacts/:id`). Empty list -> "No contacts yet". If total > 100, show "Showing the 100 most recent of N contacts."
9. Deals section (Card titled "Deals"): a table of the company's deals (up to 100, newest first) with Title (link to `/deals/:id`), Stage (`StageBadge`), Value (`formatValue`), Expected close (`formatDate` or muted "No date"). Empty -> "No deals yet". If total > 100, show "Showing the 100 most recent of N deals.". A "New deal" button toggles an inline form: Title (required), Value (required, number, min 0, step 0.01), Stage (select, defaults to Lead), Expected close date (optional, date). Submit calls `POST /companies/:companyId/deals`; on success it revalidates `/companies/:companyId` and `/deals` and redirects (push) to `/deals/<new id>`. A Cancel button closes the form.
10. `/deals/[id]` gains an "Edit deal" form (Title, Value, Expected close date) in the right column directly above the existing stage form card. Save calls `PATCH /deals/:id` with `{ title, value, expectedCloseDate }` (empty date -> `null`, which clears it; stage is never sent). On success it revalidates `/deals/:id`, `/deals` and `/companies/:companyId`, the details card shows the new values, and "Deal saved." is shown. The existing `StageForm` and its action are unchanged.
11. Every form shows each API validation issue whose `path[0]` matches a field name next to that field (`FieldError`, `aria-invalid="true"`, `aria-describedby` pointing at the error id). Issues with other paths are joined into a form-level `FormError` (`role="alert"`). On error, the form keeps the submitted values.
12. 404 messages (form-level, in `lib/messages.ts`):
    - Company edit, contact add, deal create: "This company no longer exists." (`COMPANY_NOT_FOUND_MESSAGE`).
    - Contact edit and delete: "This contact no longer exists. Reload the page to see the current contacts." (`CONTACT_NOT_FOUND_MESSAGE`).
    - Deal edit: the existing `DEAL_NOT_FOUND_MESSAGE` ("This deal no longer exists.").
    - Company delete: redirect to the "already deleted" notice (requirement 7).
    On any error (400, 404, 500, status 0) actions do not revalidate and do not redirect. Status 0 shows `API_NOT_RUNNING_MESSAGE`; other statuses show `SAVE_FAILED_MESSAGE` (saves) or `DELETE_FAILED_MESSAGE` (deletes). Errors that are not `ApiError` are rethrown.
13. Browser-side checks follow the existing `useBrowserErrors`/`blockedBy` pattern so the native popup never appears and the message shows inline: required Name/Title ("Enter a name." / "Enter a title."), required Value ("Enter a value."; the same handler covers a value the number input rejects, e.g. negative or 3 decimals, so use one message: "Enter a number of 0 or more with at most 2 decimals."), email input type ("Enter a valid email address."), website type url ("Enter a full URL starting with http:// or https://."), half-typed date ("Enter a complete date or clear the field."). The message clears when the user changes that field.
14. All new UI uses only `components/ui/*` components, layout utilities and design tokens; works in light and dark themes; request-time data is read inside `<Suspense>`.

## Acceptance criteria

1. `getCompanies({page:2,pageSize:20})` calls `GET {API_URL}/companies?page=2&pageSize=20`; `createCompany`, `updateCompany`, `deleteCompany`, `getCompanyContacts`, `createCompanyContact`, `updateContact`, `deleteContact`, `getCompanyDeals`, `createCompanyDeal` call the method/path from the contract table with a JSON body where applicable; DELETEs resolve to `undefined` on 204; ids are URL-encoded.
2. `/companies` with 3 companies renders a table with headers Name, Industry, Website; each name is a link to `/companies/<id>`; a company with `website: "https://acme.test"` renders a link with that href, `target="_blank"` and `rel="noopener noreferrer"`; null industry/website render a muted placeholder.
3. `/companies` with `meta.total = 0` shows "No companies yet"; with `total > 0` but empty `data` shows "This page is empty" and a link to `/companies`; pagination controls appear when `total > pageSize` and link to `/companies?page=N`; `getCompanies` is called with `{ page, pageSize: 20 }` where `page` comes from `?page=` (invalid -> 1).
4. `/companies` header has a link "New company" with href `/companies/new`.
5. `/companies?deleted=1` shows a `role="status"` notice "Company deleted." with a "Dismiss" link to `/companies`; `?deleted=already` shows "This company was already deleted."; any other value (including repeated params) shows nothing.
6. `addCompany` with `{name:"Acme", industry:"", website:"https://acme.test"}` calls `createCompany({ name:"Acme", industry:null, website:"https://acme.test" })`, revalidates `/companies`, and calls `redirect("/companies/<id>")`. Whitespace-only optional fields are also sent as `null`.
7. `addCompany` on a 400 with `details [{path:["website"], message:"Invalid URL"}]` returns `{status:"error", fieldErrors:{website:"Invalid URL"}, values:{name,industry,website}}`, does not revalidate or redirect; status 0 returns `API_NOT_RUNNING_MESSAGE`; 500 returns `SAVE_FAILED_MESSAGE`.
8. `editCompany("c1", ...)` sends `updateCompany("c1", {name, industry, website})` with empty optional fields as `null`; success revalidates `/companies/c1` and `/companies` and returns `{status:"success", fieldErrors:{}}`; a 400 maps field errors and keeps values; a 404 returns formError `COMPANY_NOT_FOUND_MESSAGE` and does not revalidate.
9. `removeCompany("c1")` on success calls `deleteCompany("c1")`, revalidates `/companies` and `/deals`, and calls `redirect("/companies?deleted=1", "replace")`; on 404 calls `redirect("/companies?deleted=already", "replace")`; on 500 / status 0 returns the error state (`DELETE_FAILED_MESSAGE` / `API_NOT_RUNNING_MESSAGE`) without revalidating or redirecting.
10. `addContact("c1", ...)` sends `createCompanyContact("c1", {name, email, phone, role})` (empty optional -> `null`); success revalidates `/companies/c1` and returns success; 400 maps fields `name|email|phone|role` and keeps values; 404 returns `COMPANY_NOT_FOUND_MESSAGE` without revalidating.
11. `editContact("c1", "p1", ...)` sends `updateContact("p1", {...})`; success revalidates `/companies/c1`; 400 maps fields and keeps values; 404 returns `CONTACT_NOT_FOUND_MESSAGE` without revalidating.
12. `removeContact("c1", "p1")` calls `deleteContact("p1")`; success revalidates `/companies/c1` and returns success; 404 returns `CONTACT_NOT_FOUND_MESSAGE` without revalidating; 500 returns `DELETE_FAILED_MESSAGE`.
13. `addDeal("c1", ...)` with `{title:"Big", value:"1500.50", stage:"LEAD", expectedCloseDate:""}` calls `createCompanyDeal("c1", {title:"Big", value:1500.5, stage:"LEAD"})` (no `expectedCloseDate` key); with a date `"2026-12-01"` sends it unchanged; success revalidates `/companies/c1` and `/deals` and calls `redirect("/deals/<id>")`; 400 maps fields `title|value|stage|expectedCloseDate` and keeps values; 404 returns `COMPANY_NOT_FOUND_MESSAGE`; no redirect and no revalidate on any error.
14. Value conversion (both deal actions): `""` -> `value` key omitted; a finite numeric string -> number; a non-numeric string (e.g. `"abc"`) -> sent unchanged as a string so the API reports it.
15. `editDeal("d1", "c1", ...)` with `{title:"New", value:"10", expectedCloseDate:""}` calls `updateDeal("d1", {title:"New", value:10, expectedCloseDate:null})` (no `stage` key); with a date sends it unchanged; success revalidates `/deals/d1`, `/deals`, `/companies/c1` and returns success; 400 maps `title|value|expectedCloseDate` and keeps values; 404 returns `DEAL_NOT_FOUND_MESSAGE` without revalidating.
16. Every new action rethrows an error that is not an `ApiError`.
17. Each form component (company create/edit, contact add/edit, deal create, deal edit), given an action that returns `fieldErrors` for a field, renders the message next to that field, sets `aria-invalid="true"` on that field only, and its `aria-describedby` equals the message element's id; a `formError` renders in `role="alert"`; submitted values stay in the fields after an error; the submit button is disabled and shows a pending label while the action runs.
18. The new-deal form's Stage select defaults to `LEAD` and lists all six stages with their labels; it is hidden until "New deal" is clicked and Cancel hides it again.
19. The deal edit form is prefilled with the deal's title, value and expected close date (YYYY-MM-DD, or empty) and shows "Deal saved." after a successful save.
20. `DeleteCompanyButton`: clicking "Delete company" opens a dialog named "Delete company?" whose text contains the company name in quotes and the words "contacts, deals and interactions"; Cancel closes it without calling the action; confirming calls the action once; an error result closes the dialog and shows the message in `role="alert"`.
21. `DeleteContactButton`: same flow with dialog "Delete contact?" naming the contact and confirm label "Delete contact".
22. Contact item and company details: "Edit" shows the edit form prefilled with the current values; Cancel and a successful save return to the read view and focus the Edit button.
23. `/companies/[id]` view: renders company name heading, contacts and deals (deal titles link to `/deals/<id>`, stage badges shown); calls `notFound()` when company, contacts or deals return 404 or the id gets a 400; renders "Cannot reach the API" on status 0; fetches contacts and deals with `{page:1,pageSize:100}`.
24. `/deals/[id]` still shows the stage form, and now also a form labelled "Edit deal".
25. `npm --prefix web run lint`, `typecheck`, `test` and `build` pass; existing tests still pass (only `deal-view.test.tsx` needs its actions mock extended).

## Edge cases

- Optional text fields: `""` and whitespace-only -> `null` (create and edit). Required text fields (name, title) are sent unchanged (the API trims and reports blanks such as `"   "`).
- Edit forms always send every field they show, so the PATCH body is never empty (avoids the "At least one field" refine). If the API still returns a `path: []` issue it becomes a form-level error.
- Unknown keys / unmapped validation paths -> form-level error (existing `toFormErrors` behavior).
- 400 without valid `details` -> form error with the API message (existing behavior).
- Website without protocol (`acme.com`): the browser url check blocks it inline; if it gets through, the API's field error shows.
- Value: negative, more than 2 decimals or empty are blocked inline by the browser; the API reports anything else at `value` (above max, non-numeric).
- Expected close date: empty on create -> omitted; empty on edit -> `null` (clears); before 1900 -> API field error shown.
- Company deleted in another tab while the user edits it, adds a contact or adds a deal -> 404 -> `COMPANY_NOT_FOUND_MESSAGE`, no revalidate (so the page does not swap to not-found mid-action).
- Company deleted elsewhere, then "Delete company" clicked -> 404 -> redirect to the "already deleted" notice.
- Contact deleted elsewhere, then edited/deleted -> `CONTACT_NOT_FOUND_MESSAGE`, no revalidate.
- Deal deleted elsewhere, then edited -> `DEAL_NOT_FOUND_MESSAGE`.
- API unreachable during any action -> `API_NOT_RUNNING_MESSAGE`; during page load -> `ApiUnavailable`.
- Non-UUID `/companies/abc` -> not-found page (via `loadResource`).
- `?page=` invalid / array -> page 1; page beyond the last -> "This page is empty".
- More than 100 contacts or deals -> "Showing the 100 most recent of N ..." line.
- Redirects from actions must be outside `try/catch` (redirect works by throwing).
- Select fields restored after an error need a `key` (React ignores a new `defaultValue` on a mounted select), as in `InteractionForm`.
- React resets uncontrolled forms after every form action; fields are restored from `state.values` via `defaultValue` (existing pattern). For edit forms that stay mounted after a save (deal edit), `defaultValue` falls back to the revalidated props, so the reset shows the saved values.
- A stage update on `/deals/[id]` must not wipe a half-typed deal edit form: do not key `DealEditForm` on `updatedAt` (or at all); only the submitted form is reset by React.
- Double submit: submit and confirm buttons are disabled while pending.

## Implementation plan

### Files to touch

API client and shared libs:
- `web/src/lib/types.ts` - add `Contact`, `CompanyBody`, `ContactBody`, `CreateDealBody`; make `UpdateDealBody` partial.
- `web/src/lib/api.ts` - add company, contact and company-deal endpoint functions.
- `web/src/lib/form-state.ts` - add `CompanyField`, `ContactField`, `DealField`, `DealEditField` types.
- `web/src/lib/form-data.ts` (new) - form-value helpers shared by actions (`text`, `nullableText`, `toDealValue`). A `"use server"` file may only export async functions, so helpers cannot live in the actions files.
- `web/src/lib/messages.ts` - add `COMPANY_NOT_FOUND_MESSAGE`, `CONTACT_NOT_FOUND_MESSAGE`.
- `web/src/lib/company-deleted.ts` (new) - mirror of `deal-deleted.ts` for `/companies?deleted=`.
- `web/src/lib/pagination.ts` - add `COMPANIES_PAGE_SIZE = 20`.

Server Actions:
- `web/src/app/companies/new/actions.ts` (new, `"use server"`) - `addCompany`.
- `web/src/app/companies/[id]/actions.ts` (new, `"use server"`) - `editCompany`, `removeCompany`, `addContact`, `editContact`, `removeContact`, `addDeal`.
- `web/src/app/deals/[id]/actions.ts` - add `editDeal`; replace the local `text` helper with the import from `lib/form-data.ts`.

Routes:
- `web/src/app/companies/page.tsx` (new) - list page.
- `web/src/app/companies/loading.tsx` (new) - header + table skeleton (mirror `app/deals/loading.tsx`).
- `web/src/app/companies/error.tsx` (new) - copy of `app/deals/error.tsx` (`CompaniesError`).
- `web/src/app/companies/new/page.tsx` (new) - create page (static, no request data).
- `web/src/app/companies/[id]/page.tsx` (new) - `<Suspense fallback={<CompanyDetailSkeleton/>}><CompanyView params={props.params}/></Suspense>`, typed `PageProps<"/companies/[id]">`.
- `web/src/app/companies/[id]/loading.tsx` (new) - `CompanyDetailSkeleton`.

Components (`web/src/components/companies/`, new folder):
- `companies-table.tsx` - server, table of companies.
- `companies-list.tsx` - server, reads `searchParams`, loads the page, empty states, pagination (mirror `PrioritizedDeals`).
- `companies-table-skeleton.tsx`, `company-detail-skeleton.tsx` - skeletons using `Skeleton` with `role="status"` and an `aria-label`.
- `company-deleted-notice.tsx` - mirror of `DealDeletedNotice`.
- `company-form.tsx` - client, shared create/edit form for company fields.
- `company-details.tsx` - client, read view with Edit toggle (mirror `InteractionItem` focus logic).
- `delete-company-button.tsx` - client, mirror of `DeleteDealButton`.
- `company-view.tsx` - server, loads company/contacts/deals, lays out the page (mirror `DealView`).
- `contacts-section.tsx` - server, Card with `ContactForm` (add) + list + truncation line.
- `contact-form.tsx` - client, shared add/edit form for contact fields.
- `contact-item.tsx` - client, read view + Edit toggle + `DeleteContactButton`.
- `delete-contact-button.tsx` - client, mirror of `DeleteInteractionButton`.
- `company-deals-section.tsx` - server, Card with `NewDealPanel`, `CompanyDealsTable` or empty state, truncation line.
- `company-deals-table.tsx` - server, table of `Deal`.
- `new-deal-panel.tsx` - client, title row ("Deals" + "New deal" toggle) and `DealCreateForm` when open.
- `deal-create-form.tsx` - client form (title, value, stage, expectedCloseDate).

Deals components:
- `web/src/components/deals/deal-edit-form.tsx` (new) - client form (title, value, expectedCloseDate).
- `web/src/components/deals/deal-view.tsx` - render the "Edit deal" card above the `StageForm` card and bind `editDeal`.

Tests (`web/tests/unit/`):
- `api.test.ts` - extend the existing tables for the new endpoints (URL/method/body, DELETE 204, a 404 case).
- `company-actions.test.ts` (new, node env) - `addCompany`, `editCompany`, `removeCompany`.
- `contact-actions.test.ts` (new, node env) - `addContact`, `editContact`, `removeContact`.
- `deal-create-edit-actions.test.ts` (new, node env) - `addDeal`, `editDeal`.
- `form-data.test.ts` (new) - `nullableText`, `toDealValue` table tests.
- `company-deleted.test.ts`, `company-deleted-notice.test.tsx` (new) - mirror the deal equivalents.
- `company-form.test.tsx`, `contact-form.test.tsx`, `deal-create-form.test.tsx`, `deal-edit-form.test.tsx` (new) - field errors, values kept, form error, pending, browser-side required error.
- `delete-company-button.test.tsx`, `delete-contact-button.test.tsx` (new) - confirmation flows (mirror `delete-deal-button.test.tsx`).
- `contact-item.test.tsx`, `company-details.test.tsx`, `new-deal-panel.test.tsx` (new) - toggle/cancel/focus.
- `companies-list.test.tsx`, `company-view.test.tsx` (new) - rendering, empty states, notFound, unreachable (mirror `deal-view.test.tsx`, mocking `@/app/companies/[id]/actions`).
- `deal-view.test.tsx` - add `editDeal: vi.fn()` to the actions mock and one assertion that the "Edit deal" form renders.

### Function-level changes

**`lib/types.ts`**
```ts
export interface Contact { id: string; companyId: string; name: string; email: string | null; phone: string | null; role: string | null; createdAt: string; updatedAt: string }
export interface CompanyBody { name: string; industry: string | null; website: string | null }
export interface ContactBody { name: string; email: string | null; phone: string | null; role: string | null }
// value is a number, or the raw string when it is not numeric so the API reports it.
export interface CreateDealBody { title: string; value?: number | string; stage: string; expectedCloseDate?: string }
export interface UpdateDealBody { stage?: string; title?: string; value?: number | string; expectedCloseDate?: string | null }
```

**`lib/api.ts`** (add `companyPath(id)` and `contactPath(id)` helpers like `dealPath`; make `getCompany` use `companyPath`):
- `getCompanies(query: PageQuery): Promise<Paginated<Company>>` -> `GET /companies${pageQuery(query)}`
- `createCompany(body: CompanyBody): Promise<Company>` -> POST `/companies`
- `updateCompany(id, body: CompanyBody): Promise<Company>` -> PATCH `companyPath(id)`
- `deleteCompany(id): Promise<void>` -> DELETE `companyPath(id)`
- `getCompanyContacts(companyId, query): Promise<Paginated<Contact>>` -> GET `${companyPath}/contacts${pageQuery}`
- `createCompanyContact(companyId, body: ContactBody): Promise<Contact>` -> POST `${companyPath}/contacts`
- `updateContact(id, body: ContactBody): Promise<Contact>` -> PATCH `/contacts/:id`
- `deleteContact(id): Promise<void>` -> DELETE `/contacts/:id`
- `getCompanyDeals(companyId, query): Promise<Paginated<Deal>>` -> GET `${companyPath}/deals${pageQuery}`
- `createCompanyDeal(companyId, body: CreateDealBody): Promise<Deal>` -> POST `${companyPath}/deals`
- `updateDeal` keeps its signature (body type widened).

**`lib/form-state.ts`**: `CompanyField = "name" | "industry" | "website"`, `ContactField = "name" | "email" | "phone" | "role"`, `DealField = "title" | "value" | "stage" | "expectedCloseDate"`, `DealEditField = Exclude<DealField, "stage">`.

**`lib/form-data.ts`** (pure functions, no `server-only`):
- `text(formData, name): string` (moved from deals actions; `""` for missing/non-string).
- `nullableText(value: string): string | null` -> `value.trim() === "" ? null : value`.
- `toDealValue(raw: string): number | string | undefined` -> `raw.trim() === ""` -> `undefined`; `Number.isFinite(Number(raw))` -> `Number(raw)`; else `raw`.

**`lib/messages.ts`**: `COMPANY_NOT_FOUND_MESSAGE = "This company no longer exists."`, `CONTACT_NOT_FOUND_MESSAGE = "This contact no longer exists. Reload the page to see the current contacts."`.

**`lib/company-deleted.ts`**: `CompanyDeletedOutcome = "deleted" | "already"`, `companyDeletedUrl(outcome)` -> `/companies?deleted=1|already`, `companyDeletedMessage(value)` -> "Company deleted." / "This company was already deleted." / `null`. Same structure as `deal-deleted.ts`.

**`app/companies/new/actions.ts`**
- `addCompany(_prev: FormState<CompanyField>, formData): Promise<FormState<CompanyField>>`: `values = { name, industry, website }` via `text`; `let company: Company; try { company = await createCompany({ name, industry: nullableText(industry), website: nullableText(website) }) } catch (error) { if ApiError return { status: "error", ...toFormErrors(error, COMPANY_FIELDS), values }; throw error }`; `revalidatePath("/companies")`; `redirect(\`/companies/${company.id}\`)` outside the try.

**`app/companies/[id]/actions.ts`**
- `revalidateCompany(companyId)` (private, not exported) -> `revalidatePath(\`/companies/${companyId}\`)`.
- `editCompany(companyId, _prev, formData)`: PATCH all three fields; errors -> `toFormErrors(error, COMPANY_FIELDS, { notFound: COMPANY_NOT_FOUND_MESSAGE })` + values; success -> revalidate `/companies/:id` and `/companies`, return `{ status: "success", fieldErrors: {} }`.
- `removeCompany(companyId): Promise<ActionState>`: same shape as `removeDeal`: non-404 ApiError -> `{ status: "error", ...toFormErrors(error, NO_FIELDS, { failed: DELETE_FAILED_MESSAGE }) }`; 404 -> outcome `"already"`; then revalidate `/companies` and `/deals`; `redirect(companyDeletedUrl(outcome), RedirectType.replace)`.
- `addContact(companyId, _prev, formData)`: create with `{ name, email, phone, role }` (optional ones via `nullableText`); notFound -> `COMPANY_NOT_FOUND_MESSAGE`; success -> revalidate company, return success.
- `editContact(companyId, contactId, _prev, formData)`: `updateContact(contactId, ...)`; notFound -> `CONTACT_NOT_FOUND_MESSAGE`; success -> revalidate company, return success.
- `removeContact(companyId, contactId): Promise<ActionState>`: like `removeInteraction`; notFound -> `CONTACT_NOT_FOUND_MESSAGE`, failed -> `DELETE_FAILED_MESSAGE`; success -> revalidate company.
- `addDeal(companyId, _prev: FormState<DealField>, formData)`: `const value = toDealValue(values.value)`; body `{ title, stage, ...(value !== undefined && { value }), ...(values.expectedCloseDate !== "" && { expectedCloseDate: values.expectedCloseDate }) }`; notFound -> `COMPANY_NOT_FOUND_MESSAGE`; success -> revalidate `/companies/:id` and `/deals`, then `redirect(\`/deals/${deal.id}\`)` outside the try.

**`app/deals/[id]/actions.ts`**
- `editDeal(dealId, companyId, _prev: FormState<DealEditField>, formData)`: body `{ title, ...(value !== undefined && { value }), expectedCloseDate: date === "" ? null : date }`; errors -> `toFormErrors(error, DEAL_EDIT_FIELDS)` + values (default 404 message is `DEAL_NOT_FOUND_MESSAGE`); success -> `revalidateDeal(dealId)` and `revalidatePath(\`/companies/${companyId}\`)`, return success.

**Components**
- `CompanyForm({ action, defaults?: Partial<Record<CompanyField, string>>, idPrefix, ariaLabel, submitLabel, pendingLabel, onCancel?, onSaved?, cancelHref?, autoFocus? })`: `useActionState` wrapping the action, calling `startTransition(onSaved)` on success (like `InteractionEditForm`); `useBrowserErrors<CompanyField>`; fields Name (`required`, `blockedBy("name", "Enter a name.")`), Industry, Website (`type="url"`, `blockedBy("website", ...)`). `defaultValue={values?.x ?? defaults?.x ?? ""}`. Field ids `${idPrefix}-<field>`, error ids `${idPrefix}-<field>-error` via `errorProps`. `FormError` for `formError`. Buttons: submit; Cancel is a `Button` calling `onCancel` (edit) or a `ButtonLink` to `cancelHref` (create, `/companies`). Create usage: `idPrefix="company"`, "Create company"/"Creating...". Edit usage: `idPrefix="company-edit"`, "Save"/"Saving...", Name focused on mount.
- `CompanyDetails({ company, action })`: read view = `DescriptionList` (Industry or muted "None", Website as external `TextLink` or muted "None", Created `formatDate(company.createdAt)`) and an "Edit" button (secondary, sm); editing state swaps to `CompanyForm` (edit usage) with defaults from the company (null -> ""). The form is mounted only while editing, so each opening starts from the saved values; do not key `CompanyDetails`. Focus returns to Edit after close (copy the `InteractionItem` effect).
- `DeleteCompanyButton({ companyName, action })`: copy of `DeleteDealButton`; trigger "Delete company"; title "Delete company?"; message `"${companyName}" and all of its contacts, deals and interactions will be permanently deleted. This cannot be undone.`; confirm "Delete company"; pending "Deleting...".
- `CompanyView({ params })`: `loadResource(getCompany(id))`, then `Promise.all([loadResource(getCompanyContacts(id, LIST_PAGE)), loadResource(getCompanyDeals(id, LIST_PAGE))])` with `LIST_PAGE = { page: 1, pageSize: 100 }`; any unreachable -> `ApiUnavailable`. Layout: `PageHeader` (title = name, description = industry when set, actions = `TextLink` "All companies" + `DeleteCompanyButton` with `removeCompany.bind(null, id)`), then `grid items-start gap-6 lg:grid-cols-2`: left column = `Card` with `CardTitle` "Details" + `CompanyDetails` (`editCompany.bind(null, id)`) and `ContactsSection`; right column = `CompanyDealsSection` (`addDeal.bind(null, id)`). Bind contact actions on the server through an `actionsFor(contact)` callback (same approach as `InteractionTimeline`) so client components never import the actions file.
- `ContactsSection({ contacts, total, addAction, actionsFor })`: `Card` with `CardTitle` "Contacts", `ContactForm` (add usage), `<ul>` of `ContactItem` (rows styled like the timeline: `border-b border-border pb-4 last:border-b-0`), `EmptyState` "No contacts yet", truncation line.
- `ContactForm({ action, defaults?, idPrefix, ariaLabel, submitLabel, pendingLabel, onCancel?, onSaved?, showSuccess? })`: fields Name (required, "Enter a name."), Email (`type="email"`, `blockedBy`), Phone (`type="tel"`), Role. Add usage: `idPrefix="contact"`, "Add contact"/"Adding...", shows `<p role="status" className="text-xs text-muted">Contact added.</p>` when `state.status === "success"`. Edit usage: `idPrefix={\`contact-${id}\`}`, "Save"/"Saving...", Cancel button, `onSaved`, Name focused on mount.
- `ContactItem({ contact, edit, remove })`: same structure as `InteractionItem`: summary block (name `font-medium text-foreground`; role, email, phone in `text-muted`, only those that are set) with id `contact-${id}-summary`; "Edit" ghost button with `aria-describedby` = summary id; `DeleteContactButton`.
- `DeleteContactButton({ action, contactName, describedBy })`: copy of `DeleteInteractionButton`; title "Delete contact?"; message `"${contactName}" will be permanently deleted. This cannot be undone.`; confirm "Delete contact"; pending "Deleting...".
- `CompanyDealsSection({ deals, total, createAction })`: `Card className="flex flex-col gap-5"` containing `NewDealPanel`, then `CompanyDealsTable` or `EmptyState` "No deals yet", then the truncation line.
- `NewDealPanel({ action })`: client; renders a row `flex items-center justify-between` with `CardTitle` "Deals" and a `Button` "New deal" (secondary, sm, `aria-expanded`, hidden or disabled while open is fine - choose hidden); when open renders `DealCreateForm` with `onCancel` closing it and returning focus to the "New deal" button.
- `DealCreateForm({ action, onCancel })`: fields Title (required, "Enter a title."), Value (`type="number"`, `min="0"`, `step="0.01"`, `required`, `inputMode="decimal"`, `blockedBy("value", ...)`), Stage (`Select`, options from `DEAL_STAGES` with `STAGE_LABELS`, `key={stage}`, `defaultValue={values?.stage ?? "LEAD"}`), Expected close date (optional `type="date"`, `blockedBy`); ids prefixed `new-deal-`; `aria-label="New deal"`; "Create deal"/"Creating..."; Cancel button.
- `CompanyDealsTable({ deals })`: `Table` with columns Deal (`TextLink` to `/deals/:id`), Stage (`StageBadge`), Value (`text-right tabular-nums`, `formatValue`), Expected close (`formatDate` or muted "No date").
- `CompaniesTable({ companies })` and `CompaniesList({ searchParams })`: mirror `DealsTable`/`PrioritizedDeals` with `getCompanies({ page, pageSize: COMPANIES_PAGE_SIZE })`, `basePath="/companies"`. Empty: "No companies yet" with `ButtonLink` "New company" -> `/companies/new`. Website: `<TextLink href={website} target="_blank" rel="noopener noreferrer">{website}</TextLink>` (the API guarantees http/https); null values render a muted placeholder (e.g. `<span className="text-muted">-</span>` or "None"; pick one and use it in both table and details).
- `CompanyDeletedNotice({ searchParams })`: mirror `DealDeletedNotice`, Dismiss -> `/companies` (`replace`, `scroll={false}`).
- `app/companies/page.tsx`: `PageHeader` title "Companies", description "All companies, newest first.", actions `ButtonLink href="/companies/new"` "New company"; `<Suspense fallback={null}><CompanyDeletedNotice searchParams={props.searchParams}/></Suspense>`; `<Suspense fallback={<CompaniesTableSkeleton/>}><CompaniesList searchParams={props.searchParams}/></Suspense>`.
- `app/companies/new/page.tsx`: `PageHeader` "New company" with a `TextLink` "All companies"; a `Card` (layout width e.g. `max-w-xl`) with `CompanyForm` (create usage, `action={addCompany}`).
- `DealEditForm({ deal, action })`: client; fields Title (required), Value (same input setup as the create form), Expected close date (optional), `defaultValue={values?.title ?? deal.title}`, `values?.value ?? String(deal.value)`, `values?.expectedCloseDate ?? deal.expectedCloseDate ?? ""`; `aria-label="Edit deal"`; ids prefixed `deal-edit-`; "Save changes"/"Saving..."; `<p role="status" className="text-xs text-muted">Deal saved.</p>` when `state.status === "success"`. Not keyed: React resets the submitted form and the inputs then show the revalidated deal's values; a stage update elsewhere on the page does not reset it.
- `DealView`: in the right column, before the stage `Card`, add `<Card className="flex flex-col gap-4"><CardTitle>Edit deal</CardTitle><DealEditForm deal={deal} action={editDeal.bind(null, id, deal.companyId)} /></Card>`.

### Data flow

1. Page (Server Component inside Suspense) -> `lib/api.ts` getters -> `loadResource`/`loadCollection` -> props to server components -> bound Server Actions passed to client components.
2. Client form -> `useActionState(action)` -> Server Action receives `FormData` -> `lib/form-data.ts` converts strings (`nullableText`, `toDealValue`, date rules) -> `lib/api.ts` mutation -> on success `revalidatePath(...)` and either return `{ status: "success", fieldErrors: {} }` or `redirect(...)`; on `ApiError` return a `FormState` built by `toFormErrors` (field errors keyed by `path[0]`, `formError` for status 0/404/other) plus the submitted raw `values`.
3. Delete: `useConfirmedAction(action)` -> `ConfirmDialog` -> Server Action -> redirect (company) or revalidate (contact) or an error `ActionState` shown via `FormError`.
4. Company delete notice: redirect to `/companies?deleted=1|already` -> `CompanyDeletedNotice` reads `searchParams` -> `companyDeletedMessage`.

### Sequencing

1. `lib/types.ts`, `lib/messages.ts`, `lib/form-state.ts`, `lib/pagination.ts`, `lib/form-data.ts`, `lib/company-deleted.ts`.
2. `lib/api.ts` functions; extend `api.test.ts`; add `form-data.test.ts`, `company-deleted.test.ts`.
3. Move `text` out of `app/deals/[id]/actions.ts` into `lib/form-data.ts` (existing tests must still pass), then add `editDeal`, `DealEditForm`, wire into `DealView`, extend the `deal-view.test.tsx` mock with `editDeal`, add tests.
4. Company actions files (`new/actions.ts`, `[id]/actions.ts`) and their tests.
5. Form components (`CompanyForm`, `ContactForm`, `DealCreateForm`) and delete buttons, with tests.
6. Composite components (`CompanyDetails`, `ContactItem`, `NewDealPanel`, sections, tables, `CompanyView`, `CompaniesList`, notice, skeletons) and tests.
7. Routes (`companies/page.tsx`, `loading.tsx`, `error.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/loading.tsx`).
8. Run web lint, typecheck, test, build; also API lint/typecheck/tests as CLAUDE.md requires (API untouched, so they should pass unchanged).

### Conventions to follow

- Read `web/node_modules/next/dist/docs/` for `redirect`, `revalidatePath`, Server Actions, `PageProps` and Cache Components before writing code (Next 16.4; the repo already uses `redirect(url, RedirectType.replace)` and `PageProps<"/deals/[id]">`).
- Data only via `lib/api.ts` on the server; `"use server"` action files export only async functions; client components import only types from `lib/form-state.ts` / `lib/types.ts` (never the server-only API module).
- Bind Server Action arguments on the server (`action.bind(null, id, ...)`), as in `DealView`.
- `redirect` outside `try/catch`. Never revalidate on an error path.
- Only `components/ui/*` + layout utilities; colors only from tokens (`text-muted`, `text-foreground`, `border-border`, ...); state colors only for errors/stages. No new design tokens. If a layout piece is missing, add it to `components/ui/`.
- Request-time reads (`params`, `searchParams`, API calls) only inside `<Suspense>`.
- Accessibility patterns: `Label htmlFor`, `errorProps`, `FieldError id`, `FormError role="alert"`, success messages `role="status"`, `ConfirmDialog` with `returnFocusRef`, Buttons default to `type="button"` (submit buttons need `type="submit"`).
- Tests: Vitest + RTL; `// @vitest-environment node` for action tests; `vi.mock("@/lib/api", importOriginal + vi.fn())`; mock `next/cache` and `next/navigation` (`redirect` throws a sentinel, `RedirectType` object) exactly like `interaction-actions.test.ts`; prefer `it.each`; behavior-describing names; each test must be able to fail; do not duplicate coverage already in `form-state.test.ts`.
- No new dependencies. English only. No `any`. Suggested commit: `feat: add companies pages, contact management and deal create/edit forms`.

## Open questions / assumptions

1. "New company button opens a form": implemented as a link to a dedicated `/companies/new` page, because the button lives in the server-rendered page header and an inline toggle would require turning the header into a client component. The new-deal form is an inline toggle inside the Deals card, since button and form share one card.
2. `addCompany` cannot get a 404 (no parent resource). Its tests cover success, 400 and the other error statuses; the 404 requirement applies to the actions that target an existing resource.
3. "Contact added." is shown on success without the page-version tracking `InteractionForm` uses; it disappears on the next submit. Acceptable for this feature.
4. Company/contact edit sends every field, with empty optional fields as `null` (which clears them), the natural meaning of emptying a field in an edit form.
5. Deal edit sends `expectedCloseDate: null` when the date is empty; an untouched empty date is already null, so this is a no-op.
6. Contacts and deals on the company page are not paginated: the first 100 (API max page size) are shown with a truncation line, the same approach as the deal timeline.
7. `DeleteCompanyButton` and `DeleteContactButton` copy the small existing delete-button components instead of introducing a generic one, to match the current pattern and leave existing components untouched.
8. `lib/company-deleted.ts` mirrors `lib/deal-deleted.ts` rather than generalizing it, so existing deal code and tests stay untouched.
9. `updateDealStage` is not changed (it does not revalidate the company page); these pages fetch per request, so navigating to the company page shows fresh data anyway.
10. Website and email validity are owned by the API (plus the browser's built-in `type="url"`/`type="email"` checks); the web app adds no rules of its own.
