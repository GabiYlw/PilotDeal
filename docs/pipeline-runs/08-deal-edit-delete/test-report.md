### Summary
Fix cycle 1 re-test. Framework: Vitest 5.0.5 (web, jsdom + RTL), Vitest + Supertest (api). All suites green; no product code changed.

| Command | Result |
|---|---|
| `npm --prefix web run lint` | pass, no output |
| `npm --prefix web run typecheck` | pass |
| `npm --prefix web run test` | 31 files, 287 tests passed |
| `npm --prefix web run build` | pass; `/deals` and `/deals/[id]` are Partial Prerender |
| `npm --prefix api run lint` / `typecheck` | pass |
| `npm --prefix api test` | 41 files, 879 tests passed (real test DB, migrations up to date) |

### Tests added
No new test files by the tester this cycle. The coder's cycle-1 tests were verified by mutation instead (below). Existing feature tests (from the previous cycle) cover AC 1-32 per the map.

### Mutation checks (all files restored byte-exact with `cmp`; no stray files; git status shows the same 20 modified and 20 untracked files as before)

1. **Remove `if (dialogRef.current?.open) return;` from `handleClose` in `web/src/components/ui/confirm-dialog.tsx`.**
   Result: FAILS as intended. `tests/unit/confirm-dialog.test.tsx` had 1 failed, 11 passed: "ConfirmDialog browser-driven closing > stays open under React Strict Mode, ignoring the stale close event from the effect re-run". Only that test fails.

2. **Equal versions counted as changes in `interaction-form.tsx`.**
   - First try, `if (true)` instead of the version comparison: render loop, 18 tests fail. Too blunt to prove anything.
   - Second try, a render counter instead of the version compare: 7 fail, including the target. Also too blunt.
   - Sharp mutant: keep the version compare, and also count a change whenever the props object identity differs. That is, a parent re-render with an equal `pageVersion` counts as a change. Result: exactly 1 failed, 17 passed. The failing test is "does not count a re-render with the same pageVersion as a change". The test is a precise guard for the `version !== pageVersion` comparison.

3. **Polyfill fires `close` synchronously (`queueMicrotask` removed in `web/tests/setup.ts`) with the `handleClose` guard also removed (the original bug).**
   Result: the StrictMode test FAILS under this combination too, so the original objection is not reproduced by this exact mutation. See interpretation below. Run: `confirm-dialog.test.tsx` + `dialog-polyfill.test.tsx`, 2 failed, 19 passed:
   - `confirm-dialog.test.tsx > stays open under React Strict Mode, ignoring the stale close event from the effect re-run`
   - `dialog-polyfill.test.tsx > fires close and stores returnValue on close` (expected: it asserts the async behavior)

   Interpretation: I did NOT confirm that the Strict Mode test would pass (miss the bug) with a synchronous polyfill. With the sync polyfill and no guard, the Strict Mode test still failed. A likely reason: with a synchronous close, the stale event fires inside the cleanup, before React's second setup, so `onCancel` runs and the dialog is gone from the DOM. The test therefore catches the bug in both timings, which makes it stronger than the review assumed. I did not run the sync-polyfill-with-guard-present combination, so the claim "async firing is what makes the test realistic" is not proven here. What is proven: the regression test is sensitive to the guard (mutation 1), and the polyfill's async close is itself guarded by its own test (mutation 3 fails that test).

### startTransition claim
SUPPORTED by local Next docs. `web/node_modules/next/dist/docs/01-app/02-guides/interactive-apps.md` lines 528-583 show the same pattern (`startTransition(() => setIsOpen(false))` after an `await` in a `useActionState` action). Line 570: "State updates after the `await` aren't automatically part of that transition, so wrapping `setIsOpen(false)` in `startTransition` runs the close as part of the transition." Line 574 names the React limitation ("React doesn't treat my state update after `await` as a transition") and calls the wrap "the recommended workaround". Line 572 states the benefit the coder claimed: the close is batched with the data update from `refresh()`. The Next docs speak of `refresh()`; our action uses `revalidatePath`, which is the same kind of update from the client's view. React's own docs are not installed; I did not read them.

### Failures
None.

### Spec-coverage map
| AC | Status |
|---|---|
| 1-2 API client | Covered & passing |
| 3-11 Server Actions (tests in `interaction-actions.test.ts`, accepted deviation) | Covered & passing |
| 12-14 form state, format, deal-deleted flag | Covered & passing |
| 15 danger Button variant | Covered & passing |
| 16 ConfirmDialog (plus new Strict Mode regression, mutation-verified) | Covered & passing |
| 17 node-env setup guard | Covered & passing |
| 18-26 item, edit form, delete flow | Covered & passing |
| 27-30 timeline, deal view, delete-deal button, notice | Covered & passing |
| 31 add-form tests (prop rename and "Interaction added." tests changed by the orchestrator requirement) | Covered & passing |
| 32 web lint, typecheck, test, build; api lint, typecheck, test | Passing (see Summary) |
| 33 manual browser check | Performed by the orchestrator in real Chrome on the dev server, Strict Mode on. Not performed by the tester; recorded from the orchestrator's observations below. |

### AC 33 (recorded, observed by the orchestrator in real Chrome, dev server, Strict Mode on)
- Interaction Delete via keyboard: Enter on the focused Delete button opens a modal `<dialog>` (`:modal` true), title "Delete interaction?", focus on Cancel. Escape closes it and focus returns to the same Delete button.
- Edit: changing notes then Cancel restores the original text. Reopening shows the original. Focus returns to that item's Edit button (re-created node, same position).
- Real round trip: added an interaction (score 80 -> 50, "Interaction added." shown), then deleted it through the dialog confirm. Item gone, score back to 80 (+30 days since contact), "Interaction added." hidden.
- Delete deal on a throwaway deal created via the API: the dialog warned that all interactions are deleted. Confirm redirected to `/deals?deleted=1` with `role=status` "Deal deleted." and Dismiss. API GET for that deal returns 404.
- Dark theme: dialog, danger confirm button and inline edit form render legibly. Theme restored to Light afterwards.
- Visual note (not a defect against the spec): in the light theme the dialog backdrop washes the page out almost to white. In dark it dims subtly.
- Not reported as observed: Back-button behavior after delete, Tab containment, danger hover state. These were not in the orchestrator's list, so I list them as unverified.

### Regressions
None. All previously passing web (287) and API (879) tests pass.

### Notes
- `npm run build` ran while the dev server on 3000 was up; it succeeded and I did not start or stop any server.
- No git state-changing commands were run, no `rm` on repo files, no product code edited.
