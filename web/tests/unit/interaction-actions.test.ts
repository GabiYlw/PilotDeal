// @vitest-environment node
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editInteraction, removeDeal, removeInteraction } from "@/app/deals/[id]/actions";
import {
  API_UNREACHABLE,
  ApiError,
  deleteDeal,
  deleteInteraction,
  updateInteraction,
} from "@/lib/api";
import { initialFormState } from "@/lib/form-state";
import {
  API_NOT_RUNNING_MESSAGE,
  DELETE_FAILED_MESSAGE,
  INTERACTION_NOT_FOUND_MESSAGE,
} from "@/lib/messages";
import type { Interaction } from "@/lib/types";

const REDIRECT = new Error("NEXT_REDIRECT");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw REDIRECT;
  }),
  RedirectType: { replace: "replace", push: "push" },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  updateInteraction: vi.fn(),
  deleteInteraction: vi.fn(),
  deleteDeal: vi.fn(),
}));

const updateMock = vi.mocked(updateInteraction);
const deleteInteractionMock = vi.mocked(deleteInteraction);
const deleteDealMock = vi.mocked(deleteDeal);
const revalidateMock = vi.mocked(revalidatePath);
const redirectMock = vi.mocked(redirect);

const INTERACTION = {} as Interaction;
const ORIGINAL = "2026-10-20T15:45:00.000Z";
const NOT_FOUND = new ApiError("gone", 404, "NOT_FOUND");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function edit(fields: Record<string, string>) {
  return editInteraction("d1", "i1", ORIGINAL, initialFormState(), form(fields));
}

beforeEach(() => {
  updateMock.mockReset();
  deleteInteractionMock.mockReset();
  deleteDealMock.mockReset();
  revalidateMock.mockReset();
  redirectMock.mockClear();
});

describe("editInteraction", () => {
  it.each([
    ["an unchanged date", "2026-10-20", undefined],
    ["an empty date", "", undefined],
    ["a changed date", "2026-10-22", "2026-10-22T00:00:00.000Z"],
  ])("sends the right occurredAt for %s", async (_name, date, expected) => {
    updateMock.mockResolvedValue(INTERACTION);

    await edit({ type: "CALL", notes: "Hi", occurredAt: date });

    const [id, body] = updateMock.mock.calls[0];
    expect(id).toBe("i1");
    expect(body.type).toBe("CALL");
    expect(body.notes).toBe("Hi");
    expect("occurredAt" in body).toBe(expected !== undefined);
    expect(body.occurredAt).toBe(expected);
  });

  it("revalidates the pages and returns success", async () => {
    updateMock.mockResolvedValue(INTERACTION);

    const result = await edit({ type: "CALL", notes: "Hi", occurredAt: "2026-10-20" });

    expect(revalidateMock).toHaveBeenCalledWith("/deals/d1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(result).toEqual({ status: "success", fieldErrors: {} });
  });

  it("returns field errors and the submitted values without revalidating on a 400", async () => {
    updateMock.mockRejectedValue(
      new ApiError("Invalid request body", 400, "VALIDATION_ERROR", [
        { path: ["notes"], message: "Notes is required" },
      ]),
    );
    const fields = { type: "CALL", notes: "  ", occurredAt: "2026-10-20" };

    const result = await edit(fields);

    expect(result.fieldErrors.notes).toBe("Notes is required");
    expect(result.values).toEqual(fields);
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

describe("removeInteraction", () => {
  it("deletes the interaction, revalidates the pages and returns success", async () => {
    deleteInteractionMock.mockResolvedValue(undefined);

    const result = await removeInteraction("d1", "i1");

    expect(deleteInteractionMock).toHaveBeenCalledWith("i1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals/d1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(result).toEqual({ status: "success", fieldErrors: {} });
  });

  it.each([
    ["the API is unreachable", new ApiError("down", 0, API_UNREACHABLE), API_NOT_RUNNING_MESSAGE],
    ["the API fails", new ApiError("boom", 500, "INTERNAL_ERROR"), DELETE_FAILED_MESSAGE],
  ])("returns a form error when %s", async (_name, error, message) => {
    deleteInteractionMock.mockRejectedValue(error);

    const result = await removeInteraction("d1", "i1");

    expect(result.formError).toBe(message);
  });
});

describe("a 404 from an interaction action", () => {
  it.each([
    [
      "editInteraction",
      () => {
        updateMock.mockRejectedValue(NOT_FOUND);
        return edit({ type: "NOTE", notes: "Hi" });
      },
    ],
    [
      "removeInteraction",
      () => {
        deleteInteractionMock.mockRejectedValue(NOT_FOUND);
        return removeInteraction("d1", "i1");
      },
    ],
  ])("%s shows the interaction message and does not revalidate", async (_name, run) => {
    const result = await run();

    expect(result.formError).toBe(INTERACTION_NOT_FOUND_MESSAGE);
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

describe("removeDeal", () => {
  it("deletes the deal, revalidates, and redirects with a replace to the list", async () => {
    deleteDealMock.mockResolvedValue(undefined);

    await expect(removeDeal("d1")).rejects.toBe(REDIRECT);

    expect(deleteDealMock).toHaveBeenCalledWith("d1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(redirectMock).toHaveBeenCalledWith("/deals?deleted=1", "replace");
  });

  it("redirects to the already-deleted notice on a 404", async () => {
    deleteDealMock.mockRejectedValue(NOT_FOUND);

    await expect(removeDeal("d1")).rejects.toBe(REDIRECT);

    expect(redirectMock).toHaveBeenCalledWith("/deals?deleted=already", "replace");
  });

  it.each([
    ["a 500", new ApiError("boom", 500, "INTERNAL_ERROR"), DELETE_FAILED_MESSAGE],
    ["status 0", new ApiError("down", 0, API_UNREACHABLE), API_NOT_RUNNING_MESSAGE],
  ])("returns an error state without redirecting on %s", async (_name, error, message) => {
    deleteDealMock.mockRejectedValue(error);

    const result = await removeDeal("d1");

    expect(result.formError).toBe(message);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

describe("the new actions with an error that is not an ApiError", () => {
  const boom = new Error("API_URL is not set");

  it.each([
    [
      "editInteraction",
      () => {
        updateMock.mockRejectedValue(boom);
        return edit({ type: "NOTE", notes: "Hi" });
      },
    ],
    [
      "removeInteraction",
      () => {
        deleteInteractionMock.mockRejectedValue(boom);
        return removeInteraction("d1", "i1");
      },
    ],
    [
      "removeDeal",
      () => {
        deleteDealMock.mockRejectedValue(boom);
        return removeDeal("d1");
      },
    ],
  ])("%s rethrows it", async (_name, run) => {
    await expect(run()).rejects.toBe(boom);
  });
});
