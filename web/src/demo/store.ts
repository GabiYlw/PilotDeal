import { useSyncExternalStore } from "react";
import type { Change } from "./mutations";
import { type DemoState, initialState } from "./state";

// The demo's in-memory store: one module-level state for the browser tab, nothing persisted.
// A reload runs this module again, so it starts over from the seed.
//
// The static HTML is built ahead of time, when "today" is not the visitor's today, so pages render
// the data only in the browser: the server snapshot is null and components show their skeleton
// until hydration, then the data. That also keeps the HTML and the first client render identical.

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function current(): DemoState {
  state ??= initialState(new Date());
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDemoState(): DemoState | null {
  return useSyncExternalStore(subscribe, current, () => null);
}

// Applies one mutation from ./mutations. A thrown DemoApiError leaves the state unchanged.
export function commit<T>(mutation: (state: DemoState) => Change<T>): T {
  const change = mutation(current());
  state = change.state;
  for (const listener of listeners) listener();
  return change.result;
}

// For tests: forget the state, so the next read starts from the seed again.
export function resetDemoStore(): void {
  state = null;
}
