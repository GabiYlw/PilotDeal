# Spec: Edit and delete actions on the deal page

## Task

Add Edit and Delete actions to each interaction on `/deals/[id]` and a "Delete deal" action to the page header in the Next.js 16 dashboard (`web/`). Destructive actions are confirmed in a new `ConfirmDialog` built on the native `<dialog>`. Mutations run through Server Actions that call `lib/api.ts`. After a deal is deleted, the user lands on `/deals` and sees a "Deal deleted" notice. **The API does not change.**

## Findings from the codebase (read before coding)

### API contract (verified in `api/src/modules/interactions/*` and `api/src/modules/deals/*`)

| Endpoint | Success | Errors |
|---|---|---|
| `PATCH /interactions/:id` | 200, the updated `Interaction` | 400 `VALIDATION_ERROR` "Invalid request body" with `details: { path, message }[]`; 400 "Invalid route parameters" for a non-UUID id; 404 `NOT_FOUND` "Interaction <id> not found" |
| `DELETE /interactions/:id` | **204, empty body** | 400 non-UUID id; 404 `NOT_FOUND` |
| `DELETE /deals/:id` | **204, empty body**. Interactions cascade (`onDelete: Cascade` in `schema.prisma`). | 400 non-UUID id; 404 `NOT_FOUND` |

- The `PATCH /interactions/:id` body is `z.strictObject({ type?, notes?, occurredAt? })` with a refine "At least one field must be provided". An empty body gives a 400 issue with `path: []`, which `toFormErrors` turns into a form-level error. Every field is optional, so a partial body is valid.
  - `type`: `EMAIL | CALL | MEETING | NOTE`.
  - `notes`: trimmed, 1..5000 characters.
  - `occurredAt`: ISO datetime **with an offset**, on or after 1900-01-01, not in the future.
  - Sending `notes` makes the API recompute the embedding. Leaving it out does not.
  - `dealId` cannot be changed (a strict key error).
- A 404 from `DELETE /interactions/:id` cannot tell "the interaction was deleted" apart from "the whole deal was deleted" (cascade). Both give the same 404.
- Neither deleting nor editing an interaction changes `deal.updatedAt`.
- `Interaction` response: `{ id, dealId, type, notes, occurredAt, createdAt, updatedAt }`, all dates as ISO strings with `Z` (from `Date.toJSON`). `web/src/lib/types.ts#Interaction` already mirrors this.
- `web/src/lib/api.ts#apiRequest` already handles 204: `readJson` returns `undefined` for an empty body. It sends `Content-Type` only when there is a body. `HttpMethod` already includes `"DELETE"`.

### Existing web patterns to reuse (commit 233be55 and later fixes)

- `web/src/app/deals/[id]/actions.ts` (`"use server"`, exports **only async functions**):
  - non-exported helpers `text()`, `toOccurredAt()` and `revalidateDeal()`, the last calling `revalidatePath("/deals/<id>")` and `revalidatePath("/deals")`;
  - the action shape: try only around the API call, catch `ApiError` and return a `FormState`, rethrow everything else, revalidate after success.
- `web/src/lib/form-state.ts`: `FormState<F>`, `initialFormState()`, `toFormErrors(error, fields)`. It imports `ApiError` as a type only, so client bundles stay clean. Today it maps 404 to "This deal no longer exists." and other errors to "Could not save. Please try again.".
- `web/src/components/deals/interaction-form.tsx`:
  - `useActionState`;
  - `defaultValue={state.values?.X}` so values survive an error (React resets uncontrolled forms after an action);
  - **the select `key` trick** (`key={type}`), because React ignores a new `defaultValue` on a mounted select;
  - **browser-side `required` with inline errors**: `onInvalid` runs `preventDefault`, shows the error under the field and focuses the first invalid field (`showInline`, `blockedBy`, `clearBrowserError`, `errorProps`);
  - the `dealUpdatedAt`-based "Interaction added." message.
- `web/src/components/deals/stage-form.tsx` uses the same key trick and `aria-invalid`/`aria-describedby`.
- `web/src/components/deals/deal-view.tsx` binds actions with `.bind(null, id)` in the Server Component and passes them to Client Components as props.
- `web/src/components/ui/field.tsx`: `FieldError({ id, message })`, and `FormError({ message })`, which renders `role="alert"`.
- `web/src/lib/format.ts`: UTC-only `formatDate`. Tests pin a UTC+14 zone (see the review of run 07).
- Tests:
  - Server Action tests run under `// @vitest-environment node` with `vi.mock("next/cache")`, and mock `@/lib/api` with `importOriginal` so the real `ApiError` is kept (`web/tests/unit/deal-actions.test.ts`).
  - Component tests use `fireEvent` and `act` (no `user-event` installed, and none may be added).
  - `web/tests/unit/deal-view.test.tsx` mocks `@/app/deals/[id]/actions` with an explicit list of exports. That list must grow.
- `web/tests/setup.ts` runs for **every** test file, including the node-environment ones.
- **jsdom 29.1 (installed) has no dialog behavior.** `HTMLDialogElement-impl.js` is an empty class. Only the `open` attribute reflection exists. There is no `showModal()`, no `close()`, no `returnValue`, no Escape handling and no `cancel`/`close` events.

### Next.js 16 docs the coder must read (in `web/node_modules/next/dist/docs/01-app/`)

- `03-api-reference/04-functions/redirect.md`:
  - `redirect` throws `NEXT_REDIRECT`, so call it **outside** `try`;
  - in Server Actions it defaults to `push`, and `RedirectType.replace` is available;
  - it gives a client-side navigation when JS is available.
- `01-getting-started/07-mutating-data.md`:
  - "call `revalidatePath` before `redirect`" (line ~504);
  - `refresh()` vs `revalidatePath`.
- `03-api-reference/04-functions/revalidatePath.md` and `03-api-reference/04-functions/refresh.md`. We keep `revalidatePath`, as in the existing actions. `refresh()` would also work, but mixing the two is pointless.
- `02-guides/server-actions.md`: binding arguments, what a `"use server"` file may export, sequential dispatch.
- `02-guides/forms.md`: `useActionState` and validation errors.
- `03-api-reference/03-file-conventions/page.md`, the `searchParams` section: it is a request-time API. With Cache Components, where you read it decides the static shell.
- `01-getting-started/08-caching.md`, "Maximizing the static shell": read request-time data only inside `<Suspense>`.
- `03-api-reference/02-components/link.md`, `replace` prop (used by the Dismiss link).

## Decisions

- **D1, danger Button variant: add design tokens and a variant.** Add to `globals.css`:
  - `--danger-foreground`: light `#ffffff`, dark `#0b132b`;
  - `--danger-hover`: light `#8c2131`, dark `#f6aab1`.

  Add both to the light set, the explicit dark set and the `prefers-color-scheme` dark set. Map them in `@theme inline` as `--color-danger-foreground` and `--color-danger-hover`. The variant is `danger: "border-transparent bg-danger text-danger-foreground hover:bg-danger-hover"`.

  Contrast, computed:

  | Theme | State | Pair | Ratio |
  |---|---|---|---|
  | Light | normal | `#ffffff` on `#a8283a` | about 6.9:1 |
  | Light | hover | `#ffffff` on `#8c2131` | about 8.8:1 |
  | Dark | normal | `#0b132b` on `#f3949c` | about 8.3:1 |
  | Dark | hover | `#0b132b` on `#f6aab1` | about 9.9:1 |

  The button fill against the page background is also well above 3:1 in both themes. This counts as a "state" use of the danger color, since it marks a destructive action. Use it only for the confirm button in `ConfirmDialog`. The triggers ("Delete", "Delete deal") stay `ghost`/`secondary`, so the page is not full of red.
- **D2, `ConfirmDialog` is a controlled Client Component in `components/ui/`.**
  - The parent owns `open`. The `<dialog>` element only exists while open: an inner `ConfirmDialogPanel` mounts on open and unmounts on close.
  - On mount, the panel calls `dialog.showModal()` (top layer, inert background, implicit `aria-modal`) and focuses the **Cancel** button, the safe default for a destructive confirm.
  - On unmount (cleanup), it calls `dialog.close()` if the dialog is still open, then focuses `returnFocusRef.current` if that element is still connected.
  - The return target is an explicit ref, not `document.activeElement`. Safari does not focus a button on click, so `activeElement` would be `<body>`.
  - Escape: browsers fire a cancelable `cancel` event. `onCancel` calls `event.preventDefault()` and then `onCancel()` from props, unless `pending`. So Escape and the Cancel button follow the same path: React state closes the dialog.
  - `onClose`: if the browser closes the dialog anyway (Chrome closes on a second Escape without user activation), call `onCancel()` too. The parent's `onCancel` is an idempotent `setOpen(false)`.
  - **No `keydown` Escape handler in the component.** The browser owns Escape.
- **D3, jsdom dialog polyfill in `web/tests/setup.ts`.** It emulates only what the browser does, never component logic, and runs only when needed. It is guarded by `typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal !== "function"`. The `typeof HTMLDialogElement` check matters because setup also runs in `// @vitest-environment node` files. The second check means a future jsdom with real support is used as is.
  - `showModal()`:
    - throws `DOMException("...", "InvalidStateError")` if the element is not connected;
    - returns if it is already open;
    - sets the `open` attribute;
    - adds the element to a module-level `Set` of open modals.
  - `close(returnValue?)`:
    - returns if not open;
    - removes `open`;
    - removes the element from the set;
    - stores `returnValue` on the element when given;
    - dispatches `new Event("close")`.
  - One `document` `keydown` listener (capture phase). On `Escape`, take the last-opened modal from the set, dispatch `new Event("cancel", { cancelable: true })` on it, and call `close()` if that event was not prevented. This is the browser's "cancel then close" behavior.
  - It does **not** move focus and does not touch `ConfirmDialog`. So the tests still prove the component's own behavior:
    - initial focus on Cancel;
    - focus return to the trigger;
    - Escape cancelling through `onCancel` (and not through `onConfirm`);
    - Escape ignored while pending.
  - Also add a test that `showModal` (not `show`) was called, by spying on the prototype. This proves a modal dialog is used.
  - Add a comment explaining all of the above. `close` is dispatched synchronously, while real browsers queue it. The component does not depend on that timing.
- **D4, "Deal deleted" travels as a search param.**
  - `removeDeal` calls `revalidateDeal(id)`, then `redirect(dealDeletedUrl(outcome), RedirectType.replace)`:
    - `outcome "deleted"` goes to `/deals?deleted=1`;
    - `outcome "already"` (404) goes to `/deals?deleted=already`.
  - `replace` swaps the dead `/deals/<id>` history entry, so Back does not lead to a not-found page.
  - On `/deals`, a new async Server Component `DealDeletedNotice({ searchParams })` reads `deleted` **inside its own `<Suspense fallback={null}>`**, placed between the `PageHeader` and the existing list Suspense. It renders a neutral `Notice` (`role="status"`):
    - `deleted=1` shows "Deal deleted.";
    - `deleted=already` shows "This deal was already deleted.";
    - anything else renders nothing.
  - Dismiss is a `ButtonLink variant="ghost" size="sm" href="/deals" replace scroll={false}` labelled "Dismiss". Pagination links (`/deals?page=N`) drop the param, so the notice also disappears on navigation.
  - Why not a cookie: a cookie would need `cookies()` (request-time data, also inside Suspense) plus a way to delete it after reading. Server Components cannot set cookies, so it would need an extra Server Action or a proxy. The search param is stateless, works without JS after the 303, and keeps the static shell (only the header is static, as today). Trade-off: reloading `/deals?deleted=1` shows the notice again. That is accepted.
- **D5, what the user sees on a 404.**
  - **Delete interaction, 404:**
    - the dialog closes and focus returns to that item's Delete button;
    - a `FormError` (`role="alert"`) appears in the item: "This interaction no longer exists. Reload the page to see the current timeline.";
    - the action does **not** revalidate. If it did, the item, and the message with it, would vanish at once. If the whole deal was deleted, revalidating would also swap the page for the not-found screen in the middle of the action.
  - **Edit interaction, 404:** the edit form stays open with the submitted values and shows the same message as a form-level `FormError`. No revalidation.
  - **Delete deal, 404:** treated as "the deal is gone either way". Revalidate, then redirect to `/deals?deleted=already`, which shows "This deal was already deleted.".
  - Other errors:

    | Error | Delete interaction / delete deal | Edit interaction |
    |---|---|---|
    | Status 0 | `API_NOT_RUNNING_MESSAGE` | `API_NOT_RUNNING_MESSAGE` |
    | Other `ApiError` | "Could not delete. Please try again." | "Could not save. Please try again." |
    | Not an `ApiError` | rethrown | rethrown |
  - **`redirect()` is never inside `try`.** The `try` wraps only `await deleteDeal(id)`. The catch block either returns an error state, or records the outcome `"already"` for a 404, or rethrows. `revalidateDeal` and `redirect` run after the `try/catch`. A test proves the redirect error propagates: the mocked `redirect` throws a sentinel, and the action must reject with it.
- **D6, dates in the edit form.**
  - The date input is `type="date"`, prefilled with `toDateInputValue(interaction.occurredAt)`. That is `new Date(iso).toISOString().slice(0, 10)`, the **UTC** calendar day. It matches what the timeline shows (`formatDate` is UTC), and it is independent of the browser's time zone, so there is no hydration risk. The form only renders after a click anyway.
  - On save, the action compares the submitted date with `toDateInputValue(originalOccurredAt)`, the original timestamp bound into the action.
    - **Unchanged date (or empty):** `occurredAt` is **left out** of the PATCH body, so the original time of day is kept, and so is the timeline order.
    - **Changed date:** it is sent as `YYYY-MM-DDT00:00:00.000Z` through the existing `toOccurredAt()`, exactly like the add form. The time of day is reset to UTC midnight. This is documented and accepted.
  - Picking "today" while UTC is still on the previous day gives the API's 400 "occurredAt cannot be in the future" under the Date field, which is the same known behavior as the add form.
  - The date field is `required` in the browser (inline error "Enter a date."). The API cannot clear `occurredAt`, and an empty value would mean "unchanged", which would surprise the user.
  - `type` and `notes` are always sent, so the body is never empty. Accepted cost: the API re-embeds the notes even when they did not change. The alternative was binding the original notes into the action, which would serialize up to 5000 characters per item into the page.
- **D7, several interactions can be in edit mode at once.** Each `InteractionItem` holds its own `editing` state. This is simpler than lifting state into a list-level Client Component. Every element id includes the interaction id (`interaction-<id>-notes`, ...), so they stay unique. While an item is in edit mode, its Edit and Delete buttons are hidden.
- **D8, Cancel restores the original values by unmounting.**
  - The edit form is its own component (`InteractionEditForm`), mounted only while editing. Cancel calls `onCancel()`, so the parent sets `editing=false` and the form, with its `useActionState` state and uncontrolled values, is discarded. Opening Edit again mounts a fresh form from the interaction props.
  - Cancel is disabled while a save is pending.
  - When the form closes (Cancel or a successful save), focus moves to that item's Edit button.
  - When the form opens, focus moves to its Type select.
- **D9, actions are bound on the server and passed down.**
  - `InteractionTimeline` stays a Server Component. It gets a new prop `actionsFor: (interaction: Interaction) => InteractionItemActions` from `DealView`. That is a Server-to-Server function prop, which is allowed: it never crosses to the client.
  - `actionsFor` returns `edit: editInteraction.bind(null, dealId, i.id, i.occurredAt)` and `remove: removeInteraction.bind(null, dealId, i.id)`. Both are Server References, which can be passed to the client `InteractionItem`.
  - This keeps the timeline decoupled from `actions.ts`, and its tests can pass plain `vi.fn()`.
- **D10, shared client helpers.**
  - The inline-validation helpers in `interaction-form.tsx` (`errorProps`, `showInline` and the browser-errors state) move to `web/src/lib/browser-validation.ts`, so the add form and the edit form share them. The add form's behavior must stay byte-for-byte the same: its existing tests are the guard.
  - The open/confirm/pending/error logic of the two delete buttons lives in a hook, `web/src/lib/use-confirmed-action.ts`.

## Requirements

### Data layer
1. `web/src/lib/types.ts` adds `UpdateInteractionBody { type: string; notes: string; occurredAt?: string }`. Values are raw form strings, because the API validates them.
2. `web/src/lib/api.ts` adds the following. Ids go through `encodeURIComponent`, and errors surface as `ApiError` as today.
   - `updateInteraction(id, body): Promise<Interaction>` sends `PATCH /interactions/<id>` with a JSON body.
   - `deleteInteraction(id): Promise<void>` sends `DELETE /interactions/<id>`.
   - `deleteDeal(id): Promise<void>` sends `DELETE /deals/<id>`.
3. `web/src/lib/messages.ts` adds:
   - `DEAL_NOT_FOUND_MESSAGE = "This deal no longer exists."`
   - `INTERACTION_NOT_FOUND_MESSAGE = "This interaction no longer exists. Reload the page to see the current timeline."`
   - `SAVE_FAILED_MESSAGE = "Could not save. Please try again."`
   - `DELETE_FAILED_MESSAGE = "Could not delete. Please try again."`
4. In `web/src/lib/form-state.ts`:
   - `toFormErrors(error, fields, messages?: Partial<{ notFound: string; failed: string }>)`. The defaults are `DEAL_NOT_FOUND_MESSAGE` and `SAVE_FAILED_MESSAGE`, so existing callers and tests keep their behavior.
   - Add `export type ActionState = FormState<never>` for actions that have no fields.
5. `web/src/lib/format.ts` adds `toDateInputValue(iso: string): string`, the UTC `YYYY-MM-DD` of a timestamp.
6. `web/src/lib/deal-deleted.ts` (new, no `server-only`) adds:
   - `type DealDeletedOutcome = "deleted" | "already"`;
   - `dealDeletedUrl(outcome)`, which returns `/deals?deleted=1` or `/deals?deleted=already`;
   - `dealDeletedMessage(value: string | string[] | undefined): string | null`, which gives "Deal deleted." for `"1"`, "This deal was already deleted." for `"already"`, and `null` otherwise (arrays included).

### Server Actions (`web/src/app/deals/[id]/actions.ts`, still only async exports)
7. `editInteraction(dealId, interactionId, originalOccurredAt, _prev: FormState<InteractionField>, formData)`:
   - Reads `type`, `notes` and `occurredAt` (date string) with `text()`.
   - Calls `updateInteraction(interactionId, { type, notes, ...(occurredAt && { occurredAt }) })`, where `occurredAt` is set only when the date is non-empty and differs from `toDateInputValue(originalOccurredAt)` (D6).
   - On success: `revalidateDeal(dealId)`, then return `{ status: "success", fieldErrors: {} }`.
   - `ApiError`: return `{ status: "error", ...toFormErrors(e, INTERACTION_FIELDS, { notFound: INTERACTION_NOT_FOUND_MESSAGE }), values }` with no revalidation.
   - Any other error is rethrown.
8. `removeInteraction(dealId, interactionId, _prev: ActionState): Promise<ActionState>`:
   - Calls `deleteInteraction(interactionId)`.
   - On success: `revalidateDeal(dealId)`, then return success.
   - `ApiError`: return `{ status: "error", ...toFormErrors(e, [], { notFound: INTERACTION_NOT_FOUND_MESSAGE, failed: DELETE_FAILED_MESSAGE }) }` with no revalidation.
   - Any other error is rethrown.
9. `removeDeal(dealId, _prev: ActionState): Promise<ActionState>`:
   - Wraps only `await deleteDeal(dealId)` in `try`.
   - On success, or on an `ApiError` with status 404: `revalidateDeal(dealId)`, then `redirect(dealDeletedUrl(outcome), RedirectType.replace)`, both **after** the `try/catch`.
   - On any other `ApiError`: return the error state with `failed: DELETE_FAILED_MESSAGE`. No revalidation and no redirect.
   - Errors that are not an `ApiError` are rethrown.

### UI primitives (`web/src/components/ui/`)
10. `button.tsx`: the `ButtonVariant` type and `VARIANTS` gain `danger` (D1). Tokens are added to `globals.css` for both themes.
11. `confirm-dialog.tsx` (new, `"use client"`). Props:
    ```ts
    {
      open: boolean;
      title: string;
      message: ReactNode;
      confirmLabel: string;
      pendingLabel: string;
      cancelLabel?: string; // default "Cancel"
      pending?: boolean;
      onConfirm(): void;
      onCancel(): void;
      returnFocusRef: RefObject<HTMLElement | null>;
    }
    ```
    - Renders nothing when `open` is false.
    - When open, renders a `<dialog>` with `aria-labelledby` (an `<h2>` title) and `aria-describedby` (the message), plus two buttons:
      - Cancel: `variant="secondary"`, `type="button"`;
      - confirm: `variant="danger"`, `type="button"`, showing `pendingLabel` while pending.
    - Both buttons are disabled while `pending`.
    - The behavior is the one described in D2.
    - Styling, tokens only: `m-auto w-full max-w-sm rounded-lg border border-border bg-background p-5 text-foreground backdrop:bg-background/80`. `m-auto` is needed because Tailwind's preflight removes the UA `margin: auto` that centers a modal dialog.
12. `notice.tsx` (new): `Notice({ children, action? })` renders `<div role="status">` with `flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground`. Neutral colors: a confirmation is not one of the listed states (WON/LOST/overdue/errors/health).

### Interactions timeline
13. Each timeline item (`<li>`) renders a Client Component `InteractionItem`. In view mode it shows:
    - a summary block with `id="interaction-<id>-summary"`, containing the type `Badge` and the `<time dateTime={occurredAt}>{dateLabel}</time>`. `dateLabel` is formatted on the server.
    - the notes (`whitespace-pre-line break-words`, unchanged);
    - an actions row with `Button variant="ghost" size="sm"` "Edit" and "Delete", each with `aria-describedby="interaction-<id>-summary"`.
14. Clicking Edit replaces the view with `InteractionEditForm` (D7, D8). The form has `aria-label="Edit interaction"`, `noValidate` is **not** set (browser `required` is used), and it contains:
    - a Type `Select`, prefilled with `interaction.type`, keyed with the select `key` trick;
    - a Notes `Textarea`, `required`, prefilled. An empty value shows "Enter some notes." inline.
    - a Date `Input type="date"`, `required`, prefilled with `toDateInputValue(occurredAt)`. An empty or partial value shows "Enter a date." inline.
    - a Save submit `Button` ("Saving..." and disabled while pending);
    - a Cancel `Button variant="secondary"`, disabled while pending.

    Field errors returned by the API show under the field with `FieldError`, with `aria-invalid="true"` and `aria-describedby="<field id>-error"` on the control. Form-level errors show in `FormError`. After an error the submitted values stay visible. On success, the form closes and the updated interaction shows (thanks to revalidation).
15. Clicking Delete opens a `ConfirmDialog`:
    - title "Delete interaction?";
    - message "This permanently deletes the {Type label} interaction from {dateLabel}. The next action will be recalculated.";
    - confirm "Delete interaction", pending label "Deleting...".

    Confirm dispatches the bound `removeInteraction`. On success, the page revalidates: the item disappears and the next-action panel and the list re-render. On an error, the dialog closes and the message shows in a `FormError` in the item.

### Deal page header
16. `PageHeader.actions` holds the "All deals" `TextLink` and a `DeleteDealButton` (`Button variant="secondary" size="sm"`, "Delete deal"). It opens a `ConfirmDialog`:
    - title "Delete deal?";
    - message `"{deal.title}" and all of its interactions will be permanently deleted. This cannot be undone.`;
    - confirm "Delete deal", pending label "Deleting...".

    Confirm dispatches the bound `removeDeal`. On success the user lands on `/deals?deleted=1`. On a non-404 error, the dialog closes and the `FormError` shows under the button.

### `/deals`
17. `page.tsx` adds `<Suspense fallback={null}><DealDeletedNotice searchParams={props.searchParams} /></Suspense>` between `PageHeader` and the list Suspense (D4). The notice shows `dealDeletedMessage(...)` in a `Notice` with the Dismiss link, or renders nothing.

### Cross-cutting
18. All API calls happen on the server, in Server Actions. Client Components import only types, `initialFormState`, `deal-display.ts`, `format.ts#toDateInputValue`, `browser-validation.ts`, `use-confirmed-action.ts` and the ui components. They never import `lib/api.ts` or `lib/load.ts` at runtime.
19. Only `components/ui` components, layout utilities and token colors are used. Both themes work. Everything works with the keyboard, using the global `:focus-visible` outline.
20. No new dependencies. No API changes.

## Acceptance criteria

API client (`web/tests/unit/api.test.ts`, mocked `fetch`):
1. These calls hit the exact URL, method and body, added as rows to the existing `deal endpoints` table:
   - `updateInteraction("i1", { type: "CALL", notes: "Hi" })` sends `PATCH {API_URL}/interactions/i1` with the JSON headers and body `{"type":"CALL","notes":"Hi"}`;
   - `deleteInteraction("i1")` sends `DELETE /interactions/i1`;
   - `deleteDeal("d1")` sends `DELETE /deals/d1`.
2. A `204` with an empty body resolves `deleteInteraction` and `deleteDeal` to `undefined`. A 404 `{ error: { code: "NOT_FOUND" } }` rejects with `ApiError` `{ status: 404, code: "NOT_FOUND" }`.

Server Actions (`web/tests/unit/deal-actions.test.ts`, node environment; `@/lib/api`, `next/cache` and `next/navigation` mocked):
3. `editInteraction("d1", "i1", "2026-10-20T15:45:00.000Z", state, form{type: "CALL", notes: "Hi", occurredAt: "2026-10-20"})` calls `updateInteraction("i1", { type: "CALL", notes: "Hi" })`: no `occurredAt` key, because the date did not change.
4. The same call with `occurredAt: "2026-10-22"` sends `occurredAt: "2026-10-22T00:00:00.000Z"`. With `occurredAt: ""`, the body has no `occurredAt` key.
5. On success, `editInteraction` and `removeInteraction` call `revalidatePath("/deals/d1")` and `revalidatePath("/deals")` and return `{ status: "success", fieldErrors: {} }`.
6. `editInteraction` rejecting with a 400 whose `details` are `[{ path: ["notes"], message: "Too small" }]` returns `fieldErrors.notes === "Too small"` and the submitted `values`, and does not revalidate.
7. `editInteraction` and `removeInteraction` with a 404 return `formError === INTERACTION_NOT_FOUND_MESSAGE` and do not revalidate. This is table-driven.
8. `removeInteraction("d1", "i1", state)` calls `deleteInteraction("i1")`. On status 0 it returns the "API is not running" message. On a 500 it returns "Could not delete. Please try again.".
9. `removeDeal("d1", state)` calls `deleteDeal("d1")`, revalidates `/deals`, and calls `redirect("/deals?deleted=1", "replace")`. The test mocks `next/navigation` as `{ redirect: vi.fn(() => { throw REDIRECT }), RedirectType: { replace: "replace", push: "push" } }`. The action **rejects with the `REDIRECT` sentinel**, which proves it is not swallowed.
10. `removeDeal` with a 404 calls `redirect("/deals?deleted=already", "replace")` and rejects with the sentinel. With a 500 or status 0, it resolves to an error state (`DELETE_FAILED_MESSAGE` or the API-not-running message), and neither `redirect` nor `revalidatePath` is called.
11. Every new action rethrows an error that is not an `ApiError` (one `it.each`).

Form state, format and deleted flag:
12. `toFormErrors(ApiError(404), fields, { notFound: "X" })` gives `formError "X"`. `toFormErrors(ApiError(500), fields, { failed: "Y" })` gives `"Y"`. Without the third argument, the existing messages stay the same (the existing tests pass unchanged).
13. `toDateInputValue("2026-10-22T23:30:00.000Z")` gives `"2026-10-22"` and `toDateInputValue("2026-10-01T00:00:00.000Z")` gives `"2026-10-01"`, both under the pinned UTC+14 zone in `format.test.ts`.
14. `dealDeletedMessage`:
    - `"1"` gives "Deal deleted.";
    - `"already"` gives "This deal was already deleted.";
    - `undefined`, `""`, `"0"`, `"yes"` and `["1", "1"]` give `null`.

    `dealDeletedUrl("deleted")` gives `"/deals?deleted=1"` and `dealDeletedUrl("already")` gives `"/deals?deleted=already"`.

Button and ConfirmDialog (RTL, with the setup polyfill):
15. `Button variant="danger"` has the classes `bg-danger` and `text-danger-foreground`. This is a new row in the existing `button.test.tsx` table.
16. `ConfirmDialog` tests use a harness with a trigger button that sets `open` and passes its ref as `returnFocusRef`:
    - When opened, a `dialog` named by the title is present, `HTMLDialogElement.prototype.showModal` was called (spy), and focus is on the Cancel button.
    - Clicking the confirm button calls `onConfirm` once and not `onCancel`.
    - Clicking Cancel calls `onCancel` and not `onConfirm`.
    - Pressing Escape (`fireEvent.keyDown(document.activeElement, { key: "Escape" })`) calls `onCancel` and not `onConfirm`. The dialog is gone once the harness closes it.
    - With `pending`, both buttons are disabled, the confirm button reads the pending label, and Escape does **not** call `onCancel`.
    - After Cancel or Escape, `document.activeElement` is the trigger.
17. In a node-environment test file (`deal-actions.test.ts`), the setup file does not throw. The suite runs green.

Interaction item and edit form (RTL, plain `vi.fn()` actions):
18. In view mode, each item shows "Edit" and "Delete" buttons. Their `aria-describedby` points at the element that contains the type label and the date.
19. Clicking Edit shows a form named "Edit interaction", and focus is on its Type select. The fields are prefilled:
    - Type: the interaction's type;
    - Notes: the notes;
    - Date: `toDateInputValue(occurredAt)`. For `2026-10-22T23:30:00.000Z` that is `"2026-10-22"`.
20. When the action returns `{ status: "error", fieldErrors: { notes: "Too small" }, values }`, "Too small" appears. The Notes control has `aria-invalid="true"` and `aria-describedby` equal to that message's id, and the submitted values (including the type) stay in the fields.
21. A form-level error shows in a `role="alert"` element.
22. Cancel restores the original values. Change the type, notes and date, then click Cancel. The view shows the original notes, and focus is on the item's Edit button. Click Edit again: all three fields hold the original values. The same holds after a failed submit followed by Cancel.
23. When the action resolves to success, the form closes, the view mode is back, and focus is on the Edit button.
24. With empty notes, submit shows "Enter some notes." under Notes and the action is not called. An empty date shows "Enter a date.".
25. While the save is pending, Save reads "Saving..." and both Save and Cancel are disabled.
26. The Delete flow:
    - click Delete, then the dialog's "Delete interaction" button: `remove` is called once;
    - when it resolves to `{ status: "error", fieldErrors: {}, formError: INTERACTION_NOT_FOUND_MESSAGE }`, the dialog closes and the message shows in a `role="alert"` element inside the item;
    - clicking Cancel in the dialog never calls `remove`.

Timeline, deal view and notice:
27. `InteractionTimeline` calls `actionsFor` once per interaction and renders one `InteractionItem` per interaction, in the given order. The existing timeline tests still pass, now with an `actionsFor` stub.
28. `DealView` renders a "Delete deal" button in the header. The existing `deal-view` tests pass, with `editInteraction`, `removeInteraction` and `removeDeal` added to the actions mock.
29. `DeleteDealButton`:
    - opens a dialog whose message contains the deal title and "all of its interactions";
    - confirm calls the action;
    - an error state closes the dialog and shows the message in a `role="alert"` element.
30. `DealDeletedNotice` with `searchParams = Promise.resolve({ deleted: "1" })` renders a `role="status"` element with "Deal deleted." and a "Dismiss" link with `href="/deals"`. With `{}`, it renders nothing (render it through a fragment: `render(<>{await DealDeletedNotice(...)}</>)`).

Overall:
31. The existing `interaction-form.test.tsx` passes unchanged after the `browser-validation.ts` refactor.
32. `npm --prefix web run lint`, `typecheck`, `test` and `build` pass. The build keeps `/deals` and `/deals/[id]` as Partial Prerender, with no "uncached data outside Suspense" error. The API is untouched. Running `npm --prefix api run lint`, `typecheck` and `test` still passes, as CLAUDE.md requires.
33. A manual check in a browser, in the light and dark themes, using only the keyboard:
    - the dialog is centered, the backdrop is visible, Tab stays inside the dialog, Escape closes it, and focus returns;
    - the danger button is readable, normal and hovered;
    - deleting an interaction updates the next-action panel;
    - deleting a deal lands on `/deals` with the notice, Dismiss removes it, and Back does not open the deleted deal.

    New files contain no raw colors and no palette classes.

## Edge cases

- **Interaction already deleted** (another tab): delete or edit gets a 404 and shows `INTERACTION_NOT_FOUND_MESSAGE` with no revalidation (D5). A retry gives the same message. Reloading fixes the timeline.
- **Deal deleted elsewhere while on its page:**
  - interaction delete or edit gets a 404 (cascade) and shows the interaction message; reloading then shows the not-found page;
  - Delete deal gets a 404 and goes to `/deals?deleted=already`;
  - add-interaction and the stage form keep their "This deal no longer exists." message.
- **API unreachable** during any action: the friendly hint, no crash. The dialog closes, and the edit form stays open with its values.
- **API 5xx or unexpected body:** "Could not delete. Please try again." or "Could not save. Please try again.".
- **`API_URL` missing** (a plain `Error`): rethrown, and reaches `error.tsx`, as today.
- **Escape while a delete is pending:** ignored, because `cancel` is prevented. If a browser force-closes the dialog anyway, `onClose` calls `onCancel`, and the action still finishes and shows its result.
- **Double confirm:** the confirm button is disabled while pending, and React dispatches actions in order.
- **Focus target gone:** after a successful interaction delete, the item, and its trigger, unmount. `returnFocusRef.current` is then null or disconnected, so focus is not moved (it falls to `<body>`). Accepted (see open question 3).
- **Unchanged edit** (Save without changes): the PATCH carries `type` and `notes` (never an empty body, so never the "At least one field" 400). `occurredAt` is left out, and the time of day is kept.
- **Date changed:** stored at UTC midnight, so the time of day is lost. Accepted (D6).
- **Future date, or "today" before the UTC day turns:** API 400 under Date.
- **Partial or invalid date typed:** `validity.badInput` makes `required` fail, so the browser blocks the submit and "Enter a date." shows inline.
- **Whitespace-only notes:** pass the browser's `required` check. The API trims them and answers 400, shown under Notes.
- **Several items in edit mode:** independent. Ids are unique per interaction.
- **Revalidation while editing** (for example the stage form saves): the item keeps its key (`interaction.id`), so the open form and the typed values survive.
- **A date edit reorders the list:** keyed items move without losing state.
- **`?deleted=` with other values or an array:** no notice. Reloading `/deals?deleted=1` shows the notice again (accepted). Pagination links drop it.
- **Non-UUID ids** cannot reach these actions, because the page would already have been not found. A stray 400 becomes a form-level error through `toFormErrors`.
- **"Interaction added." after a later delete:** the add form's message depends on `deal.updatedAt`, which interaction deletes do not change, so the message can stay visible. This is existing behavior and out of scope (open question 4).
- **Node-environment test files:** the polyfill guard prevents `ReferenceError: HTMLDialogElement is not defined`.

## Implementation plan

### Files to touch

Web library:
- `web/src/lib/types.ts` (modify): add `UpdateInteractionBody`.
- `web/src/lib/api.ts` (modify): add `updateInteraction`, `deleteInteraction`, `deleteDeal`, and an `interactionPath(id)` helper.
- `web/src/lib/messages.ts` (modify): add the four message constants.
- `web/src/lib/form-state.ts` (modify): add the `messages` parameter to `toFormErrors` and the `ActionState` type. Use the message constants.
- `web/src/lib/format.ts` (modify): add `toDateInputValue`.
- `web/src/lib/deal-deleted.ts` (new): the URL and message helpers for the deleted flag.
- `web/src/lib/browser-validation.ts` (new): `errorProps`, `showInline`, `useBrowserErrors`, extracted from `interaction-form.tsx`.
- `web/src/lib/use-confirmed-action.ts` (new): a hook for dialog plus action state.

Web styles and UI primitives:
- `web/src/app/globals.css` (modify): add `--danger-foreground` and `--danger-hover` to all three theme blocks and to `@theme inline`.
- `web/src/components/ui/button.tsx` (modify): add the `danger` variant.
- `web/src/components/ui/confirm-dialog.tsx` (new): `ConfirmDialog`.
- `web/src/components/ui/notice.tsx` (new): `Notice`.

Web feature components:
- `web/src/components/deals/interaction-form.tsx` (modify): use `browser-validation.ts`. No behavior change.
- `web/src/components/deals/interaction-timeline.tsx` (modify): add the `actionsFor` prop. Each `<li>` renders `InteractionItem`.
- `web/src/components/deals/interaction-item.tsx` (new, client): view/edit toggle and focus management.
- `web/src/components/deals/interaction-edit-form.tsx` (new, client): the inline edit form.
- `web/src/components/deals/delete-interaction-button.tsx` (new, client): the Delete button, its dialog and its error.
- `web/src/components/deals/delete-deal-button.tsx` (new, client): the Delete deal button, its dialog and its error.
- `web/src/components/deals/deal-deleted-notice.tsx` (new, async Server Component).
- `web/src/components/deals/deal-view.tsx` (modify): header actions, `actionsFor` binding, new action imports.

Web routes:
- `web/src/app/deals/[id]/actions.ts` (modify): add `editInteraction`, `removeInteraction`, `removeDeal`.
- `web/src/app/deals/page.tsx` (modify): add the notice Suspense.

Web tests (`web/tests/`):
- `setup.ts` (modify): the guarded dialog polyfill (D3).
- `unit/api.test.ts` (modify): AC 1-2.
- `unit/deal-actions.test.ts` (modify): AC 3-11. Add `next/navigation` to the mocks, and `updateInteraction`, `deleteInteraction` and `deleteDeal` to the `@/lib/api` mock.
- `unit/form-state.test.ts` (modify): AC 12.
- `unit/format.test.ts` (modify): AC 13.
- `unit/deal-deleted.test.ts` (new): AC 14.
- `unit/button.test.tsx` (modify): AC 15.
- `unit/confirm-dialog.test.tsx` (new): AC 16.
- `unit/interaction-edit-form.test.tsx` (new): AC 19-21, 24-25.
- `unit/interaction-item.test.tsx` (new): AC 18, 22, 23, 26.
- `unit/delete-deal-button.test.tsx` (new): AC 29.
- `unit/deal-deleted-notice.test.tsx` (new): AC 30.
- `unit/interaction-timeline.test.tsx` (modify): AC 27. Add the `actionsFor` stub.
- `unit/deal-view.test.tsx` (modify): AC 28. Extend the actions mock with the three new names as `vi.fn()`. `vi.fn().bind` works.

Do not touch `api/`, `.claude/` or `CLAUDE.md`.

### Function-level changes

**`web/src/lib/api.ts`**
```ts
function interactionPath(id: string): string { return `/interactions/${encodeURIComponent(id)}`; }
export function updateInteraction(id: string, body: UpdateInteractionBody): Promise<Interaction> {
  return apiRequest<Interaction>(interactionPath(id), { method: "PATCH", body });
}
export function deleteInteraction(id: string): Promise<void> {
  return apiRequest<void>(interactionPath(id), { method: "DELETE" });
}
export function deleteDeal(id: string): Promise<void> {
  return apiRequest<void>(dealPath(id), { method: "DELETE" });
}
```

**`web/src/lib/form-state.ts`**
- `export type ActionState = FormState<never>;`
- `interface ErrorMessages { notFound: string; failed: string }`.
- `toFormErrors<F extends string>(error, fields: readonly F[], messages: Partial<ErrorMessages> = {})`:
  - 404 returns `messages.notFound ?? DEAL_NOT_FOUND_MESSAGE`;
  - the final fallback returns `messages.failed ?? SAVE_FAILED_MESSAGE`;
  - status 0 and 400 are unchanged.
- The `import type { ApiError }` stays type-only.

**`web/src/lib/format.ts`**
- `export function toDateInputValue(iso: string): string { return new Date(iso).toISOString().slice(0, 10); }`
- Comment: "UTC day, the same day formatDate shows; independent of the browser's time zone, so safe in Client Components."

**`web/src/lib/deal-deleted.ts`**: the helpers in requirement 6. Keep the two messages as constants here, or in `messages.ts`.

**`web/src/lib/browser-validation.ts`** (no `"use client"` directive needed; it is imported only by client components):
- `export type ValidatedField = HTMLInputElement | HTMLTextAreaElement;`
- `export function errorProps(id: string, message: string | undefined)`: moved verbatim.
- `export function showInline(event: InvalidEvent<ValidatedField>): void`: moved verbatim, with its comment.
- `export function useBrowserErrors<F extends string>()` returns `{ browserErrors, blockedBy(field, message), clearBrowserError(field), resetBrowserErrors() }`. It wraps the `useState` and the functions currently inline in `InteractionForm`.

**`web/src/lib/use-confirmed-action.ts`**
```ts
export function useConfirmedAction(action: (state: ActionState) => Promise<ActionState>) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(async (previous: ActionState) => {
    const next = await action(previous); // no try/catch: a redirect thrown by the action must propagate
    setOpen(false);
    return next;
  }, initialFormState<never>());
  return {
    open, pending, error: state.formError,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
    confirm: () => startTransition(() => dispatch()), // dispatch must run inside a transition
  };
}
```
Use the no-payload `useActionState` overload. Calling `dispatch` outside `startTransition` logs a React warning and `pending` stays false.

**`web/src/components/ui/button.tsx`**
- `ButtonVariant = "primary" | "secondary" | "ghost" | "danger"`.
- `danger: "border-transparent bg-danger text-danger-foreground hover:bg-danger-hover"`.

**`web/src/components/ui/confirm-dialog.tsx`** (`"use client"`)
- `ConfirmDialog(props)` returns `props.open ? <ConfirmDialogPanel {...props} /> : null`.
- `ConfirmDialogPanel`:
  - `const dialogRef = useRef<HTMLDialogElement>(null)`, `cancelRef`, and `titleId`/`messageId` from `useId()`.
  - `useEffect(() => { const dialog = dialogRef.current; if (dialog && !dialog.open) dialog.showModal(); cancelRef.current?.focus(); return () => { if (dialog?.open) dialog.close(); const target = returnFocusRef.current; if (target?.isConnected) target.focus(); }; }, [])`.
  - Read `returnFocusRef` in the cleanup, as written. eslint `react-hooks/exhaustive-deps` may ask for the ref in the deps. Add it: a ref object is stable.
  - `handleCancel(event: SyntheticEvent<HTMLDialogElement>) { event.preventDefault(); if (!pending) onCancel(); }`, passed as `onCancel`.
  - `handleClose() { onCancel(); }`, passed as `onClose`. It runs only when the browser closed the dialog by itself. Our own `close()` happens in cleanup, after React has detached the handlers.
  - Markup:
    - `<dialog ref aria-labelledby aria-describedby onCancel onClose className=...>`;
    - `<h2 id={titleId} className="text-sm font-medium text-foreground">`;
    - `<div id={messageId} className="mt-2 text-sm text-muted">` (a `div`, so `message` may contain block nodes);
    - a button row `mt-5 flex justify-end gap-2`: Cancel first in the DOM, then confirm.

**`web/src/components/ui/notice.tsx`**: `Notice({ children, action }: { children: ReactNode; action?: ReactNode })`.

**`web/src/components/deals/interaction-timeline.tsx`**
- `export interface InteractionItemActions { edit: EditInteractionAction; remove: RemoveInteractionAction }`. Export the two action types from `interaction-item.tsx`, or a types-only spot, and import them as types.
- Props: `{ interactions; total; actionsFor: (interaction: Interaction) => InteractionItemActions }`.
- Each item: `<li key={i.id} className="(existing li classes)"><InteractionItem interaction={i} dateLabel={formatDate(i.occurredAt)} {...actionsFor(i)} /></li>`.
- The `TimelineItem` content moves into `InteractionItem`'s view mode.

**`web/src/components/deals/interaction-item.tsx`** (`"use client"`)
```ts
export type EditInteractionAction = (state: FormState<InteractionField>, formData: FormData) => Promise<FormState<InteractionField>>;
export type RemoveInteractionAction = (state: ActionState) => Promise<ActionState>;
export function InteractionItem({ interaction, dateLabel, edit, remove }: {...})
```
- State: `editing`. Ref: `editButtonRef`. A ref flag `returnFocusToEdit`.
- `closeEditor()` sets the flag, then `setEditing(false)`. A `useEffect` on `[editing]`: when `!editing` and the flag is set, focus `editButtonRef`, then clear the flag.
- Editing renders `<InteractionEditForm interaction action={edit} onCancel={closeEditor} onSaved={closeEditor} />`.
- View mode:
  - the summary div `id="interaction-<id>-summary"` with `Badge` and `time`;
  - the notes `<p>`;
  - an actions row `flex gap-1` with an Edit `Button` (ghost, sm, ref, `aria-describedby`) and `<DeleteInteractionButton action={remove} typeLabel dateLabel describedBy />`.

**`web/src/components/deals/interaction-edit-form.tsx`** (`"use client"`)
- Props: `{ interaction: Interaction; action: EditInteractionAction; onCancel(): void; onSaved(): void }`.
- `useActionState(async (prev, formData) => { const next = await action(prev, formData); if (next.status === "success") onSaved(); return next; }, initialFormState<InteractionField>())`.
- `useBrowserErrors<InteractionField>()`. `onSubmit` calls `resetBrowserErrors()`.
- Ids are `interaction-${interaction.id}-type`, `-notes` and `-date`. Error ids add `-error`.
- The Type `Select` has `key={values?.type ?? interaction.type}` and `defaultValue={values?.type ?? interaction.type}`, plus a ref focused on mount.
- Notes `defaultValue={values?.notes ?? interaction.notes}`, `required`, `onInvalid={blockedBy("notes", "Enter some notes.")}`, `onChange={() => clearBrowserError("notes")}`.
- Date `type="date"` with `defaultValue={values?.occurredAt ?? toDateInputValue(interaction.occurredAt)}`, `required`, `onInvalid={blockedBy("occurredAt", "Enter a date.")}`.
- Labels: "Type", "Notes", "Date".
- `FormError message={state.formError}`.
- Buttons:
  - `<Button type="submit" size="sm" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>`;
  - `<Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>Cancel</Button>`.

**`web/src/components/deals/delete-interaction-button.tsx`** (`"use client"`)
- Props: `{ action: RemoveInteractionAction; typeLabel: string; dateLabel: string; describedBy: string }`.
- Uses `useConfirmedAction(action)` and a `triggerRef`.
- Renders the ghost sm "Delete" button (`onClick=openDialog`), `ConfirmDialog` (requirement 15, `returnFocusRef={triggerRef}`, `onConfirm={confirm}`, `onCancel={closeDialog}`, `pending`), and `<FormError message={error} />`.

**`web/src/components/deals/delete-deal-button.tsx`** (`"use client"`)
- Props: `{ dealTitle: string; action: (state: ActionState) => Promise<ActionState> }`.
- Same structure as the interaction button, with the copy from requirement 16, wrapped in `flex flex-col items-end gap-1` so the error sits under the button.

**`web/src/components/deals/deal-view.tsx`**
- Import `editInteraction`, `removeInteraction` and `removeDeal`.
- `actions={<><TextLink href="/deals" className="text-sm">All deals</TextLink><DeleteDealButton dealTitle={deal.title} action={removeDeal.bind(null, id)} /></>}`.
- `<InteractionTimeline interactions total actionsFor={(interaction) => ({ edit: editInteraction.bind(null, id, interaction.id, interaction.occurredAt), remove: removeInteraction.bind(null, id, interaction.id) })} />`.

**`web/src/components/deals/deal-deleted-notice.tsx`**
- `async function DealDeletedNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })`.
- `const message = dealDeletedMessage((await searchParams).deleted); if (!message) return null;`
- Returns `<Notice action={<ButtonLink href="/deals" variant="ghost" size="sm" replace scroll={false}>Dismiss</ButtonLink>}>{message}</Notice>`.

**`web/src/app/deals/[id]/actions.ts`**
- Imports: `redirect, RedirectType` from `next/navigation`; `deleteDeal`, `deleteInteraction`, `updateInteraction` from `@/lib/api`; `type ActionState` from `@/lib/form-state`; `toDateInputValue` from `@/lib/format`; `dealDeletedUrl, type DealDeletedOutcome` from `@/lib/deal-deleted`; the message constants.
- Non-exported constants: `NO_FIELDS = [] as const`, `DELETE_MESSAGES` and `INTERACTION_MISSING`.
- Non-exported helper `changedOccurredAt(date: string, original: string): string | undefined` returns `date === "" || date === toDateInputValue(original) ? undefined : toOccurredAt(date)`.
- `removeDeal`:
```ts
let outcome: DealDeletedOutcome = "deleted";
try {
  await deleteDeal(dealId);
} catch (error) {
  if (!(error instanceof ApiError)) throw error;
  if (error.status !== 404) return { status: "error", ...toFormErrors(error, NO_FIELDS, { failed: DELETE_FAILED_MESSAGE }) };
  outcome = "already";
}
revalidateDeal(dealId);
redirect(dealDeletedUrl(outcome), RedirectType.replace); // outside try: redirect throws NEXT_REDIRECT
```
- Comment why the 404 still redirects (D5).

**`web/src/app/deals/page.tsx`**
- Add `<Suspense fallback={null}><DealDeletedNotice searchParams={props.searchParams} /></Suspense>` after `PageHeader`.
- Update the comment: searchParams are still read only inside Suspense.

**`web/tests/setup.ts`**: add the polyfill from D3 after the cleanup hook. Sketch:
```ts
const openModals = new Set<HTMLDialogElement>();
if (typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { ... };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) { ... };
  document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; const top = [...openModals].at(-1); if (!top) return;
    if (top.dispatchEvent(new Event("cancel", { cancelable: true }))) top.close(); }, true);
}
```
Keep it typed (no `any`). Comment: it emulates the browser only, and focus is intentionally not emulated.

### Data flow

```
Interaction Delete:
  [Delete] -> ConfirmDialog (showModal, focus Cancel)
  -> confirm -> startTransition(dispatch) -> removeInteraction(dealId, id) [server]
       -> DELETE /interactions/:id
          204 -> revalidatePath(/deals/id, /deals) -> page re-renders (timeline, NextActionPanel re-fetch)
          404 -> { formError: INTERACTION_NOT_FOUND_MESSAGE } (no revalidate)
  -> setOpen(false) -> dialog unmounts -> close() + focus trigger (if still mounted)

Interaction Edit:
  [Edit] -> InteractionEditForm (prefill: type, notes, toDateInputValue(occurredAt) UTC)
  -> submit -> editInteraction(dealId, id, originalOccurredAt, prev, formData) [server]
       -> body { type, notes, occurredAt? (only if date changed, as YYYY-MM-DDT00:00:00.000Z) }
       -> PATCH /interactions/:id
          200 -> revalidate -> success -> onSaved -> view mode, focus Edit
          400 -> fieldErrors + values; 404 -> INTERACTION_NOT_FOUND_MESSAGE
  [Cancel] -> unmount form -> originals on next open

Deal Delete:
  [Delete deal] -> ConfirmDialog -> removeDeal(dealId) [server]
       -> DELETE /deals/:id
          204 | 404 -> revalidatePath -> redirect(/deals?deleted=1 | already, replace)   (outside try)
          other -> { formError }
  /deals: PageHeader (static) | Suspense -> DealDeletedNotice(searchParams.deleted) | Suspense -> PrioritizedDeals
```
There are no new API endpoints or schemas. The only new web types are `UpdateInteractionBody` and `ActionState`.

### Sequencing

1. Library code and its tests:
   - `messages.ts`, then `form-state.ts` (with tests);
   - `format.ts#toDateInputValue` (with tests);
   - `deal-deleted.ts` (with tests);
   - `types.ts`, then `api.ts` (with tests).
2. `actions.ts` with its tests (AC 3-11).
3. Tokens in `globals.css`, the `danger` Button variant (with tests), `Notice`.
4. The `setup.ts` polyfill, then `ConfirmDialog` with its tests. Run the full web test suite here to confirm the node-env files still pass.
5. `browser-validation.ts`, then refactor `interaction-form.tsx`. The existing tests must pass unchanged.
6. `use-confirmed-action.ts`, then:
   - `DeleteInteractionButton`;
   - `InteractionEditForm` (with tests);
   - `InteractionItem` (with tests);
   - `InteractionTimeline` (update its tests).
7. `DeleteDealButton` (with tests), then `deal-view.tsx` (update its tests).
8. `DealDeletedNotice` (with tests), then `app/deals/page.tsx`.
9. Run `npm --prefix web run lint`, `typecheck`, `test` and `build`. Also run `npm --prefix api run lint`, `typecheck` and `test` (CLAUDE.md requires them). Then do the manual browser check in both themes, keyboard only.

### Conventions to follow

- `"use server"` files export only async functions. Constants and types go to `lib/`.
- `redirect` stays outside `try`. `revalidatePath` runs before `redirect`.
- Client Components never import `lib/api.ts` or `lib/load.ts`. `form-state.ts` keeps `import type { ApiError }`.
- Only `components/ui` components, layout utilities and token colors. `className` on ui components is for layout only (joined with `cn`, which does not resolve conflicts). Components stay small, one per file.
- Every new token has a light and a dark value that meets WCAG AA (D1 ratios). Add both to the explicit dark block **and** the `prefers-color-scheme` block.
- Keep the patterns from `interaction-form.tsx`:
  - `defaultValue={values?.x ?? original}`;
  - the select `key` trick;
  - `aria-invalid`/`aria-describedby` only when there is an error;
  - `FormError` for form-level errors;
  - `onInvalid` with `showInline`.
- Tests:
  - `fireEvent`/`act` only;
  - `it.each` for table cases;
  - behavior-describing names;
  - each test able to fail;
  - no duplicate coverage. For example, `toFormErrors` message mapping is tested in `form-state.test.ts`, so the action tests need one representative row per message.
  - Component tests pass plain `vi.fn()` actions. They never call a real API.
- No `any`, TypeScript strict. No new dependencies.
- In `.pipeline/implementation.md`, explain D2-D6 in plain English: the controlled dialog and its focus handling, why the polyfill does not weaken the tests, search param vs cookie, the 404 behavior, and the date rule.
- Suggested commit: `feat: add edit and delete actions to the deal page`.

## Open questions / assumptions

1. **Delete triggers are not red.** Only the confirm button uses `danger` (D1), so the state color stays tied to the destructive moment. If the reviewer wants a red "Delete deal" trigger, it is a one-word variant change.
2. **New tokens vs CLAUDE.md.** The UI rules list the token names. `danger-foreground` and `danger-hover` are new. Do not edit `CLAUDE.md` in this task. Flag it for the human to add the two names to the list.
3. **Focus after a successful interaction delete** falls to `<body>`, because the trigger is gone. Moving it to the Interactions heading would need a cross-item ref. Left out for simplicity.
4. **"Interaction added." can linger** after a later edit or delete, because `deal.updatedAt` does not change. This is existing behavior. Fixing it would need a timeline "version" prop. Out of scope.
5. **The edit always sends `notes`**, so the API re-embeds even when the notes did not change (D6). Accepted for simplicity. The embedding is local and fast.
6. **The deal-delete 404 redirects** instead of showing an inline error (D5). The page is for a deal that no longer exists, so the list is where the user needs to be. The notice text makes the difference clear.
7. **The notice's `role="status"`** may not be announced by every screen reader when it is rendered as part of a navigation. It is still visible and readable. Accepted.
8. **`::backdrop` with `bg-background/80`** relies on `::backdrop` inheriting custom properties (current Chrome, Firefox and Safari). In an older browser the backdrop would just be transparent. The dialog stays modal.
