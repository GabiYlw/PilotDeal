import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_UNREACHABLE, ApiError, askCrm, EMBEDDING_UNAVAILABLE } from "@/lib/api";
import { runAsk } from "@/lib/ask";
import type { AskResponse } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  askCrm: vi.fn(),
}));

const response: AskResponse = {
  answer: null,
  answeredBy: "none",
  insufficientInformation: false,
  citedInteractionIds: [],
  sources: [],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("runAsk", () => {
  it("returns the response and sends the body as given", async () => {
    vi.mocked(askCrm).mockResolvedValue(response);

    expect(await runAsk({ question: "q?", dealId: "d1" })).toEqual({
      status: "ok",
      data: response,
    });
    expect(askCrm).toHaveBeenCalledWith({ question: "q?", dealId: "d1" });
  });

  it("maps a question validation issue to a field error", async () => {
    const details = [{ path: ["question"], message: "Question must be at least 3 characters" }];
    vi.mocked(askCrm).mockRejectedValue(new ApiError("x", 400, "VALIDATION_ERROR", details));

    const outcome = await runAsk({ question: "" });

    expect(outcome).toMatchObject({
      status: "invalid",
      fieldErrors: { question: "Question must be at least 3 characters" },
    });
    expect(outcome).not.toHaveProperty("formError", expect.any(String));
  });

  it("maps another validation issue to a form error", async () => {
    const details = [{ path: ["dealId"], message: "dealId must be a valid UUID" }];
    vi.mocked(askCrm).mockRejectedValue(new ApiError("x", 400, "VALIDATION_ERROR", details));

    expect(await runAsk({ question: "abc" })).toEqual({
      status: "invalid",
      fieldErrors: {},
      formError: "dealId must be a valid UUID",
    });
  });

  it.each<[string, ApiError, string]>([
    ["a 404", new ApiError("x", 404, "NOT_FOUND"), "dealMissing"],
    [
      "a 503 EMBEDDING_UNAVAILABLE",
      new ApiError("x", 503, EMBEDDING_UNAVAILABLE),
      "searchStarting",
    ],
    ["status 0", new ApiError("x", 0, API_UNREACHABLE), "unreachable"],
  ])("maps %s to %s", async (_name, error, status) => {
    vi.mocked(askCrm).mockRejectedValue(error);

    expect(await runAsk({ question: "abc" })).toEqual({ status });
  });

  it.each<[string, unknown]>([
    ["a 500", new ApiError("x", 500, "INTERNAL")],
    ["a 503 with another code", new ApiError("x", 503, "OTHER")],
    ["a plain error", new Error("boom")],
  ])("rethrows %s", async (_name, error) => {
    vi.mocked(askCrm).mockRejectedValue(error);

    await expect(runAsk({ question: "abc" })).rejects.toBe(error);
  });
});
