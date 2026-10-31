> **Note:** The two follow-ups from this review were done after this pipeline run, in the same commit. The dialog backdrop now uses a new `--overlay` token (light: navy at 35%, dark: black at 55%) through `backdrop:bg-overlay`, instead of `bg-background/80`, which washed the light theme out to white. It was checked in Chrome in both themes. The CLAUDE.md token list now includes `danger-foreground`, `danger-hover` and `overlay`.

### Summary
Re-review after fix cycle 1. I read the full tracked diff (`.pipeline/diff.tmp.patch`, 20 files) and all 20 untracked files again.

All previous findings are resolved:
- **High (Strict Mode stale `close`) is fixed correctly.** `handleClose` now returns early when the dialog is open again. The jsdom polyfill now queues `close` the way browsers do. A Strict Mode regression test exists, and the tester's mutation run shows it fails without the guard.
- **Medium (AC 33)** was done by the orchestrator in real Chrome with Strict Mode on: keyboard open, focus on Cancel, Escape, focus return, edit cancel, a real delete round trip that updated the next-action panel, deal delete leading to the notice, and the dark theme.
- **All Low items are resolved.** That covers the `startTransition` wraps, the `interaction-form` test consolidation plus the same-version test, the disconnected-modal handling in the polyfill, and the small test cleanups.

I found no regressions. Two Low items remain, neither blocking:
- the light-theme backdrop is almost white;
- a few AC 33 sub-checks were not observed directly. They are guaranteed by the platform or covered by unit tests.

### Findings

#### Critical
None

#### High
None

#### Medium
None

#### Low
1. **`web/src/components/ui/confirm-dialog.tsx:77`: in the light theme the backdrop `backdrop:bg-background/80` washes the page out almost to white.**
   - Light `--background` is `#ffffff`, so the overlay is 80% white over the page. The dialog (`bg-background`, also white) is then set apart only by a 1px `#dde3eb` border, which gives weak figure/ground.
   - In dark it works, because 80% of `#0b132b` dims the page.
   - Linear-style modals dim the page behind them in both themes, with a darker, slightly transparent overlay.
   - Not a defect against the spec: the spec prescribed exactly this class (requirement 11). It is functionally fine (the dialog is modal, readable and centered), and it uses tokens only. So this is graded Low, cosmetic.
   - Suggested follow-up: add one theme token `--overlay`, for example light `rgb(11 19 43 / 0.35)` and dark `rgb(0 0 0 / 0.55)`, in all three theme blocks plus `@theme inline` as `--color-overlay`, and use `backdrop:bg-overlay`.
     - It is not text, so the 4.5:1 rule does not apply. It still needs a light and a dark value, per the UI rules.
     - Do not use `bg-foreground/x`: in dark, foreground is white and would lighten the page.
2. **AC 33 sub-items not observed directly** (`.pipeline/test-report.md:61`). These four were not observed. Each is guaranteed by construction, so I accept them, but the human should run a one-minute check before committing.
   - **Back after a deal delete:**
     - `removeDeal` calls `redirect(..., RedirectType.replace)` (`web/src/app/deals/[id]/actions.ts:124`), which is verified by the `"replace"` argument assertion in `interaction-actions.test.ts:164`. The orchestrator saw the redirect land on `/deals?deleted=1`, so the action-redirect path works.
     - Worst case, if replace were not honored, Back would show the existing not-found page, which is graceful.
     - Low risk.
   - **Tab containment:** `showModal()` is confirmed by the orchestrator (`:modal` true). It makes the rest of the document inert, so Tab can only reach the two dialog buttons and the browser chrome. That is native, spec-defined behavior, not component code. No risk.
   - **Danger hover:**
     - `hover:bg-danger-hover` maps to `--color-danger-hover`, which is defined in all three theme blocks (`globals.css:36,61,86,111`).
     - The contrast I re-computed matches D1: about 8.8:1 light and 9.9:1 dark.
     - The orchestrator confirmed the normal state was legible in both themes.
     - No risk.
   - **Dismiss removing the notice:** it is a `ButtonLink href="/deals" replace` (`deal-deleted-notice.tsx:16`, href unit-tested). Without `deleted`, `dealDeletedMessage` returns `null` (unit-tested). Low risk.
3. **Note for the human (not a code defect):** `CLAUDE.md:89` lists the allowed token names, and `danger-foreground` and `danger-hover` are now in use. Add them to that list (and `overlay`, if finding 1 is taken up). CLAUDE.md was correctly left unedited.

### Verification of previous findings
- **High 1: resolved.**
  - `handleClose` (`confirm-dialog.tsx:65-68`) returns early when `dialogRef.current?.open`.
  - **Can the guard swallow a legitimate close?** No. A browser-initiated close (Chrome's second Escape, a close request) sets `open = false` before the `close` task is queued. Only our own effect setup calls `showModal()` between a close and the delivery of its event. That happens with the Strict Mode re-run, or with an `<Activity>` hide/show. In both cases the dialog is meant to stay open, and ignoring the event is right.
  - After a real unmount, React has detached the element's props, so the cleanup's own `close()` reaches no handler.
  - If a force-close happens while pending, `onCancel` closes the panel and the later `startTransition(() => setOpen(false))` is idempotent.
- **Async polyfill (`tests/setup.ts:611`): it does not weaken the other tests.**
  - The Cancel and Escape tests close through React state. The panel unmounts, and the queued `close` hits a detached element, so the assertions do not depend on it.
  - The force-close test (`confirm-dialog.test.tsx:138-145`) now awaits inside `act` and still proves that `open === false` leads to `onCancel`.
  - The polyfill test asserts that `close` is not fired synchronously (`dialog-polyfill.test.tsx:44`), so the async timing is itself guarded.
  - With a synchronous polyfill the Strict Mode test would fail even with the guard in place, because the event fires while `open` is false. That matches what browsers do and is why the async queue is required. The tester showed the test fails without the guard (mutation 1).
  - The setup comment is now accurate.
- **Low 3: resolved and correct per `web/node_modules/next/dist/docs/01-app/02-guides/interactive-apps.md:528-574`.**
  - `startTransition(() => setOpen(false))` after the `await` (`use-confirmed-action.ts:12`) is exactly the documented pattern.
  - `startTransition(onSaved)` (`interaction-edit-form.tsx:34`) is equivalent. `closeEditor` sets a ref synchronously inside the callback, which is fine.
  - On a redirect the action rejects before `setOpen`, which is intended. Non-`ApiError` failures still propagate to `error.tsx`.
  - `confirm: () => startTransition(() => dispatch())` is unchanged and correct.
- **Low 4: resolved.** One "disappears after a second change" test, plus "does not count a re-render with the same pageVersion" (`interaction-form.test.tsx:935-943`). The tester showed with a sharp mutation that the latter guards the `version !== pageVersion` comparison.
- **Low 5: resolved.** Escape prunes disconnected modals (`tests/setup.ts:620`), with a test at `dialog-polyfill.test.tsx:94-104`.
- **Low 6: resolved.**
  - The notice test keeps a single "renders nothing" case.
  - The round-trip test was removed from `deal-deleted.test.ts`.
  - The timeline mock is typed `vi.fn<(item: Interaction) => InteractionItemActions>` and needs no cast.

### Spec adherence
- AC 1-2 (API client): met.
- AC 3-11 (Server Actions): met.
  - Accepted deviations: the tests live in `interaction-actions.test.ts`, and the unused `_previous` parameter was dropped.
  - `redirect` comes after the `try/catch` and after `revalidateDeal`. A sentinel test proves the redirect error propagates.
- AC 12-14 (form state, format, deleted flag): met.
- AC 15 (danger variant and tokens in all three blocks): met.
- AC 16 (ConfirmDialog): met. There is now also Strict Mode coverage.
- AC 17 (setup guard in node-environment files): met.
- AC 18-26 (item, edit form, delete flow): met.
- AC 27-30 (timeline, deal view, delete-deal button, notice inside its own Suspense): met.
- AC 31 (add-form tests): met in spirit. Only the orchestrator-driven prop rename and the "Interaction added." block changed.
- AC 32 (web lint/typecheck/test/build: 31 files, 287 tests; PPR kept for `/deals` and `/deals/[id]`; API lint/typecheck/test: 879 tests; API untouched): met.
- AC 33 (manual browser check): met. The core flows were verified in real Chrome under Strict Mode in both themes. The remaining sub-items are guaranteed by construction (Low 2). I grep-checked the new files: no raw colors and no palette classes.
- Cross-cutting checks: no client import of `lib/api.ts` or `lib/load.ts`, no business logic in the web app, no new dependencies, no `any`, the `"use server"` file exports only async functions.

### Verdict
PASS. The High is fixed with a minimal, correct guard, and the guard does not swallow a legitimate browser-initiated close. The polyfill now matches browser timing without weakening the other tests, and a Strict Mode test that was shown by mutation to catch the bug protects the fix. `startTransition` is used exactly as the local Next.js docs recommend. AC 33 was performed in a real browser. What is left are cosmetic or verification-hygiene notes: the light-theme backdrop, a quick human check of Back, Tab, hover and Dismiss, and the CLAUDE.md token list. There are no Critical, High or Medium findings, no open test failures and no unmet acceptance criteria.

STATUS: PASS
