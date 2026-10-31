import { useState } from "react";

// Counts how many times pageVersion changed since the last resetChanges() (called on submit).
// React's "adjust state while rendering" pattern, not an effect: the count updates in the same
// render that sees the new prop.
export function usePageChanges(pageVersion: string): {
  changes: number;
  resetChanges: () => void;
} {
  const [tracking, setTracking] = useState({ version: pageVersion, changes: 0 });
  if (tracking.version !== pageVersion) {
    setTracking({ version: pageVersion, changes: tracking.changes + 1 });
  }
  return {
    changes: tracking.changes,
    resetChanges: () => setTracking({ version: pageVersion, changes: 0 }),
  };
}

// The user's own add changes the page data exactly once (the new item), and that change can
// arrive before or after the action result, so one change is allowed. A second change (an edit,
// a delete, a stage update) means an "added" message no longer describes what the user just did.
export const CHANGES_FROM_OWN_ADD = 1;
