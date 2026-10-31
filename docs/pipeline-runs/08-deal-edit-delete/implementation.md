### Summary
Edit and Delete for each interaction, and "Delete deal" in the deal page header, all through Server Actions and a native-`<dialog>` `ConfirmDialog`. After a deal delete the user lands on `/deals?deleted=1` with a "Deal deleted." notice. The API is unchanged. Per the orchestrator, the add form's "Interaction added." message now also disappears after an interaction edit or delete (and a stage update), but stays after the user's own add.

### Files changed
Library: `web/src/lib/{types,api,messages,form-state,format}.ts` (new API calls, messages, `ActionState`, `toFormErrors` messages arg, `toDateInputValue`); new `deal-deleted.ts`, `browser-validation.ts`, `use-confirmed-action.ts`, `page-version.ts`.
UI: `globals.css` (danger-foreground/danger-hover tokens, all three theme blocks), `ui/button.tsx` (danger variant), new `ui/confirm-dialog.tsx`, `ui/notice.tsx`.
Deal components: new `interaction-item.tsx`, `interaction-edit-form.tsx`, `delete-interaction-button.tsx`, `delete-deal-button.tsx`, `deal-deleted-notice.tsx`; modified `interaction-form.tsx` (shared validation helpers, `pageVersion` prop), `interaction-timeline.tsx` (`actionsFor`), `deal-view.tsx`.
Routes: `app/deals/[id]/actions.ts` (`editInteraction`, `removeInteraction`, `removeDeal`), `app/deals/page.tsx` (notice in its own Suspense).
Tests: `tests/setup.ts` (guarded dialog polyfill); modified `api`, `form-state`, `format`, `button`, `deal-view`, `interaction-form`, `interaction-timeline` tests; new `interaction-actions`, `deal-deleted`, `page-version`, `confirm-dialog`, `interaction-item`, `delete-deal-button`, `deal-deleted-notice` tests.

### The "Interaction added." message (orchestrator change)
Problem: the old check compared `deal.updatedAt` captured at submit time. Adding an interaction does not change `deal.updatedAt` but does change the list, and edit/delete change only the list, so a submit-time snapshot of a version that includes interactions cannot work (the version after the user's own add is not known at submit).

Design: `DealView` computes `pageVersion(deal, interactions, total)` (`lib/page-version.ts`): a short FNV-1a fingerprint of `deal.updatedAt`, the total, and every `id@updatedAt`. The add form takes it as the `pageVersion` prop (replacing `dealUpdatedAt`). The form keeps `{ version, changes }` state. If the prop differs from the stored version during render, it stores the new version and increments `changes` (React's "adjust state while rendering" pattern, no effect). Submit resets `changes` to 0. The message shows when `status === "success" && changes <= 1`. The user's own add causes exactly one change; a stage update, edit or delete is a second change and hides it.

Ordering assumption: I could not confirm from the docs or React behavior that the revalidated RSC payload and the `useActionState` result land in the same render. So the design does not depend on it. It counts changes, not their order, and two tests cover both orders (new data before the action result, and after). Total is in the fingerprint so an add that falls outside the 100-item window still changes the version. Known limit: if an unrelated change lands before the own add's revalidation arrives, the two coalesce or count as 2; accepted.

Mutation check: replacing `changes <= 1` with `true` fails the 3 "disappears" tests; with `< 1` fails 6 tests (stays visible, ordering, counting).

### Decisions in plain English
- Controlled dialog (D2): the parent owns `open`; the `<dialog>` is mounted only while open, calls `showModal()` and focuses Cancel (safe default), and on unmount closes and returns focus to an explicit ref (Safari does not focus buttons on click). Escape fires `cancel`, which we prevent and route to `onCancel`, so Escape and Cancel share one path; ignored while pending.
- Polyfill (D3): jsdom has no dialog behavior. The polyfill only emulates what the browser does itself (open attribute, close event, Escape then cancel then close), is guarded so node-environment files and future jsdom skip it, and does not move focus, so tests still prove the component's own focus handling.
- Search param over cookie (D4): stateless, works after a 303, keeps the static shell. Reload shows the notice again (accepted). `redirect` is outside `try` and uses `replace` so Back does not land on the dead deal.
- 404 (D5): interaction 404s show a message with no revalidation (it would remove the item/message or swap the page mid-action). Deal 404 redirects with "already deleted".
- Dates (D6): date input is the UTC day; an unchanged date is left out of the PATCH so time of day is kept; a changed date is UTC midnight.

### Deviations from spec
- Server Action tests for the new actions are in a new file `tests/unit/interaction-actions.test.ts`, not appended to `deal-actions.test.ts` (same node environment and mocks; avoided a very large rewrite of the existing file).
- `removeInteraction(dealId, interactionId)` and `removeDeal(dealId)` drop the unused `_previous` parameter (eslint warned; a shorter function is still assignable to `(state) => Promise`). Tests call them without it.
- `ConfirmDialog` effect copies `returnFocusRef.current` at effect start (lint rule), still guarded by `isConnected`.
- No `show` spy in the dialog test (jsdom has no `show`); only the `showModal` spy.
- Add form prop renamed `dealUpdatedAt` -> `pageVersion` (orchestrator change); its tests updated accordingly, other add-form tests unchanged in behavior.
- Not done: the manual keyboard check in a browser in both themes (AC 33). I did not start servers or drive a browser.
- Flag for the human: `danger-foreground` and `danger-hover` are new tokens; CLAUDE.md was not edited.

### Notes for tester/reviewer
No new dependencies. API untouched. The raw `DELETE` returns 204; `apiRequest` already handles empty bodies. Edit always sends `type` and `notes`, so the API re-embeds notes. Several items can be in edit mode at once.

### Command results
- `npm --prefix web run lint`: pass, no warnings.
- `npm --prefix web run typecheck`: pass.
- `npm --prefix web run test`: 29 files, 269 tests passed.
- `npm --prefix web run build`: pass; `/deals` and `/deals/[id]` remain Partial Prerender.
- `npm --prefix api run lint` and `typecheck`: pass. `npm --prefix api test`: 41 files, 879 tests passed.

## Fix cycle 1

### Fix-cycle log
1. **High, ConfirmDialog closes itself under Strict Mode** (`web/src/components/ui/confirm-dialog.tsx`). Root cause: the Strict Mode effect cleanup calls `dialog.close()`, setup reopens it, then the browser's queued `close` event reaches React's `onClose` and calls `onCancel`. Fix: `handleClose` returns early when `dialogRef.current?.open` is true. A real browser-forced close has `open === false`, so that path still works. The effect cleanup is unchanged.
   - `web/tests/setup.ts`: the polyfill now queues `close` with `queueMicrotask`, like browsers queue a task. The wrong comment is replaced.
   - New regression test in `confirm-dialog.test.tsx` ("stays open under React Strict Mode..."): renders the harness in `<StrictMode>`, opens it, flushes the queued event, and expects the dialog open with `onCancel` not called. I ran it before the fix, where it failed (no dialog in the DOM, the exact production symptom), and after the fix it passes. The force-close and polyfill tests were made async.
   - Broader StrictMode rendering: not added to the forms. Their effects (a focus call on mount) are idempotent and the Strict Mode-sensitive logic lives only in the dialog. The "adjust state while rendering" form code was reviewed as safe. A blanket StrictMode wrapper would add duplicate coverage.
2. **AC 33**: left to the orchestrator (real Chrome).
3. **Low, updates after await** (`use-confirmed-action.ts`, `interaction-edit-form.tsx`): `setOpen(false)` and `onSaved()` are wrapped in `startTransition`. React docs ("Updates after await in Actions") say state updates after an `await` in an Action lose the transition context and must be wrapped in `startTransition` again. This makes them commit together with the revalidated data instead of a frame earlier.
4. **Low, tests**: `interaction-form.test.tsx` has one "disappears after a second change of the page data" test instead of the three-row `it.each`, plus "does not count a re-render with the same pageVersion as a change" (three re-renders with `v2`). That test fails if the form counted renders instead of comparing versions; I did not run a mutation to prove it, only reasoned from the `version !== pageVersion` check.
5. **Low, polyfill open set**: Escape now deletes disconnected modals from `openModals` and targets the last connected one. New polyfill test "never targets a modal that was removed from the document".
6. **Low, small items**: removed the round-trip test in `deal-deleted.test.ts`; the notice test keeps one "renders nothing" case (`{}`); the timeline test types the mock as `vi.fn<(item: Interaction) => InteractionItemActions>` and drops the cast.

### Results (actual)
- Web: lint clean, typecheck clean, 31 files / 287 tests pass, build succeeds.
- API (untouched): lint and typecheck clean, 41 files / 879 tests pass.
- No dependencies added, API unchanged, no git mutations.

Suggested commit: `fix: ignore stale close events in ConfirmDialog under Strict Mode`
