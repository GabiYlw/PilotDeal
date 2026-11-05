// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addInteraction, updateDealStage } from "@/app/deals/[id]/actions";
import { API_UNREACHABLE, ApiError, createDealInteraction, updateDeal } from "@/lib/api";
import { initialFormState } from "@/lib/form-state";
import type { Deal, Interaction } from "@/lib/types";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createDealInteraction: vi.fn(),
  updateDeal: vi.fn(),
}));

const createMock = vi.mocked(createDealInteraction);
const updateMock = vi.mocked(updateDeal);
const revalidateMock = vi.mocked(revalidatePath);

// The actions ignore the returned resource, so any value works.
const INTERACTION = {} as Interaction;
const DEAL = {} as Deal;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function validationError(path: string, message: string): ApiError {
  return new ApiError("Invalid request body", 400, "VALIDATION_ERROR", [{ path: [path], message }]);
}

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  revalidateMock.mockReset();
});

describe("addInteraction", () => {
  const state = initialFormState<"type" | "notes" | "occurredAt">();

  it("sends the date as a UTC timestamp", async () => {
    createMock.mockResolvedValue(INTERACTION);

    await addInteraction(
      "d1",
      state,
      form({ type: "CALL", notes: "Hi", occurredAt: "2026-10-22" }),
    );

    expect(createMock).toHaveBeenCalledWith("d1", {
      type: "CALL",
      notes: "Hi",
      occurredAt: "2026-10-22T00:00:00.000Z",
    });
  });

  it("leaves occurredAt out when the date is empty", async () => {
    createMock.mockResolvedValue(INTERACTION);

    await addInteraction("d1", state, form({ type: "NOTE", notes: "Hi", occurredAt: "" }));

    expect(createMock.mock.calls[0][1]).not.toHaveProperty("occurredAt");
  });

  it("revalidates the deal and the list and returns success", async () => {
    createMock.mockResolvedValue(INTERACTION);

    const result = await addInteraction("d1", state, form({ type: "NOTE", notes: "Hi" }));

    expect(revalidateMock).toHaveBeenCalledWith("/deals/d1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(result).toEqual({ status: "success", fieldErrors: {} });
  });

  it("returns field errors and the submitted values without revalidating on a 400", async () => {
    createMock.mockRejectedValue(validationError("notes", "Notes is required"));

    const result = await addInteraction(
      "d1",
      state,
      form({ type: "CALL", notes: "", occurredAt: "" }),
    );

    expect(result.fieldErrors.notes).toBe("Notes is required");
    expect(result.values).toEqual({ type: "CALL", notes: "", occurredAt: "" });
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the API is unreachable", new ApiError("down", 0, API_UNREACHABLE), "API is not running"],
    ["the deal is gone", new ApiError("gone", 404, "NOT_FOUND"), "This deal no longer exists."],
    [
      "the API fails",
      new ApiError("boom", 500, "INTERNAL_ERROR"),
      "Could not save. Please try again.",
    ],
  ])("returns a form error when %s", async (_name, error, message) => {
    createMock.mockRejectedValue(error);

    const result = await addInteraction("d1", state, form({ type: "NOTE", notes: "Hi" }));

    expect(result.formError).toContain(message);
  });

  it("rethrows errors that are not ApiErrors", async () => {
    createMock.mockRejectedValue(new Error("API_URL is not set"));

    await expect(addInteraction("d1", state, form({ type: "NOTE", notes: "Hi" }))).rejects.toThrow(
      "API_URL",
    );
  });

  it("puts an unmapped validation path into the form error", async () => {
    createMock.mockRejectedValue(validationError("extra", "Unrecognized key"));

    const result = await addInteraction("d1", state, form({ type: "NOTE", notes: "Hi" }));

    expect(result.fieldErrors).toEqual({});
    expect(result.formError).toBe("Unrecognized key");
  });
});

describe("updateDealStage", () => {
  const state = initialFormState<"stage">();

  it("updates the stage and revalidates the pages", async () => {
    updateMock.mockResolvedValue(DEAL);

    const result = await updateDealStage("d1", state, form({ stage: "WON" }));

    expect(updateMock).toHaveBeenCalledWith("d1", { stage: "WON" });
    expect(revalidateMock).toHaveBeenCalledWith("/deals/d1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(result.status).toBe("success");
  });

  it("returns the stage field error on a 400", async () => {
    updateMock.mockRejectedValue(validationError("stage", "Invalid enum value"));

    const result = await updateDealStage("d1", state, form({ stage: "NOPE" }));

    expect(result.fieldErrors.stage).toBe("Invalid enum value");
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});
