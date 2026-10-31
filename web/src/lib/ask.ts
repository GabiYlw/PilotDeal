import "server-only";
import { ApiError, askCrm, EMBEDDING_UNAVAILABLE } from "./api";
import { type AskField, toFormErrors } from "./form-state";
import type { AskBody, AskResponse } from "./types";

export type AskOutcome =
  | { status: "ok"; data: AskResponse }
  | { status: "invalid"; fieldErrors: Partial<Record<AskField, string>>; formError?: string }
  | { status: "dealMissing" }
  | { status: "searchStarting" }
  | { status: "unreachable" };

const ASK_FIELDS = ["question"] as const;

// Turns the API's failures into page states. Anything unexpected is rethrown to error.tsx.
export async function runAsk(body: AskBody): Promise<AskOutcome> {
  try {
    return { status: "ok", data: await askCrm(body) };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 0) return { status: "unreachable" };
    if (error.status === 400) return { status: "invalid", ...toFormErrors(error, ASK_FIELDS) };
    if (error.status === 404) return { status: "dealMissing" };
    if (error.status === 503 && error.code === EMBEDDING_UNAVAILABLE) {
      return { status: "searchStarting" };
    }
    throw error;
  }
}
