---
description: Run the four-agent feature pipeline (planner → coder → tester → reviewer) for a task, handing work off through .pipeline/*.md. Loops on FAIL up to 3 cycles. Never commits.
argument-hint: <task description>
---

You are the **orchestrator** of a four-agent feature pipeline. Subagents cannot call each other, so you drive the full sequence yourself, in the current project's working directory. The task is:

> $ARGUMENTS

If `$ARGUMENTS` is empty, ask the user for a task description and stop.

## Hard rules
- **Never commit.** Do not run `git add`, `git commit`, or any git mutation. The user commits manually after reviewing.
- All `.pipeline/` files live in the **current project's working directory**, never in `~` or `~/.claude`.
- Pass each agent the task and the paths to the artifacts it needs; agents communicate only through the `.pipeline/*.md` files.

## Flow

### 1. Fresh run: create/reset .pipeline/
Remove any prior run and create an empty directory in the current working directory:
```
rm -rf .pipeline && mkdir -p .pipeline
```
(Run this in the project root — confirm you are not in `$HOME`.)

### 2. Plan → Code → Test → Review (initial pass)
Invoke these subagents **in sequence**, waiting for each to finish and write its file before starting the next:

1. **planner** — give it the task `$ARGUMENTS`. It writes `.pipeline/spec.md`.
2. **coder** — tell it to read `.pipeline/spec.md` and implement it. It writes source code and `.pipeline/implementation.md`.
3. **tester** — tell it to read `.pipeline/spec.md` and `.pipeline/implementation.md`, write/run tests, and write `.pipeline/test-report.md`.
4. **reviewer** — tell it to read `.pipeline/spec.md`, `.pipeline/implementation.md`, `.pipeline/test-report.md`, and the working-tree diff. Run `git diff` yourself (read-only) and paste it into the reviewer's prompt so it can review the real changes. `git diff` does NOT show new untracked files, so also run `git ls-files --others --exclude-standard` (read-only), exclude anything under `.pipeline/`, and give the reviewer that list, telling it to Read every one of those new files in full. It writes `.pipeline/review.md`.

### 3. Read the verdict and loop on FAIL
Read the **last line** of `.pipeline/review.md`. It is exactly `STATUS: PASS` or `STATUS: FAIL`.

- If `STATUS: PASS` → go to step 4.
- If `STATUS: FAIL` → run a fix cycle:
  1. **coder** — tell it to read `.pipeline/review.md` and fix every finding; it updates the code and appends to `.pipeline/implementation.md`.
  2. **tester** — re-run; overwrite `.pipeline/test-report.md`.
  3. **reviewer** — re-review with the fresh `git diff` plus the fresh list of untracked files (same as step 2.4); overwrite `.pipeline/review.md`.
  4. Re-read the final STATUS line.

Repeat the fix cycle until `STATUS: PASS` **or 3 cycles have run** (the initial pass plus up to 3 fix cycles). Stop after 3 fix cycles even if still FAIL.

### 4. Summarize (do NOT commit)
Print a summary containing:
- **Final status**: PASS or FAIL, and how many cycles it took.
- **Pipeline files**: paths to `.pipeline/spec.md`, `.pipeline/implementation.md`, `.pipeline/test-report.md`, `.pipeline/review.md`.
- **Changed files**: output of `git status --short` / `git diff --stat` so the user sees exactly what to review.
- If FAIL after 3 cycles: the remaining findings from `.pipeline/review.md` so the user knows what is unresolved.

End by reminding the user that nothing was committed — they should review the diff and commit themselves.
