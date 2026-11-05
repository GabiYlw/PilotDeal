// @vitest-environment node
// Error paths the per-feature action tests leave out: unreachable API and 500 for the save actions,
// the unreachable API for removeContact, and the non-ApiError rethrow of editContact.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addContact,
  addDeal,
  editCompany,
  editContact,
  removeContact,
} from "@/app/companies/[id]/actions";
import { editDeal } from "@/app/deals/[id]/actions";
import {
  API_UNREACHABLE,
  ApiError,
  createCompanyContact,
  createCompanyDeal,
  deleteContact,
  updateCompany,
  updateContact,
  updateDeal,
} from "@/lib/api";
import { initialFormState } from "@/lib/form-state";
import { API_NOT_RUNNING_MESSAGE, SAVE_FAILED_MESSAGE } from "@/lib/messages";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  RedirectType: { replace: "replace", push: "push" },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createCompanyContact: vi.fn(),
  createCompanyDeal: vi.fn(),
  updateCompany: vi.fn(),
  updateContact: vi.fn(),
  updateDeal: vi.fn(),
  deleteContact: vi.fn(),
}));

const DOWN = new ApiError("x", 0, API_UNREACHABLE);
const FAILING = new ApiError("x", 500, "INTERNAL");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const CONTACT = form({ name: "Ann", email: "", phone: "", role: "" });
const COMPANY = form({ name: "Acme", industry: "", website: "" });
const NEW_DEAL = form({ title: "Big", value: "1", stage: "LEAD", expectedCloseDate: "" });
const EDIT_DEAL = form({ title: "Big", value: "1", expectedCloseDate: "" });

type SaveCase = [string, () => Promise<{ formError?: string }>, (error: Error) => void];

const SAVE_ACTIONS: SaveCase[] = [
  [
    "editCompany",
    () => editCompany("c1", initialFormState(), COMPANY),
    (e) => vi.mocked(updateCompany).mockRejectedValue(e),
  ],
  [
    "addContact",
    () => addContact("c1", initialFormState(), CONTACT),
    (e) => vi.mocked(createCompanyContact).mockRejectedValue(e),
  ],
  [
    "editContact",
    () => editContact("c1", "p1", initialFormState(), CONTACT),
    (e) => vi.mocked(updateContact).mockRejectedValue(e),
  ],
  [
    "addDeal",
    () => addDeal("c1", initialFormState(), NEW_DEAL),
    (e) => vi.mocked(createCompanyDeal).mockRejectedValue(e),
  ],
  [
    "editDeal",
    () => editDeal("d1", "c1", initialFormState(), EDIT_DEAL),
    (e) => vi.mocked(updateDeal).mockRejectedValue(e),
  ],
];

beforeEach(() => {
  vi.mocked(revalidatePath).mockReset();
  vi.mocked(redirect).mockReset();
});

describe.each(SAVE_ACTIONS)("%s", (_name, run, arrange) => {
  it.each([
    ["the API is unreachable", DOWN, API_NOT_RUNNING_MESSAGE],
    ["the API answers 500", FAILING, SAVE_FAILED_MESSAGE],
  ])(
    "shows a form error and neither revalidates nor redirects when %s",
    async (_case, error, message) => {
      arrange(error);

      const result = await run();

      expect(result.formError).toBe(message);
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );
});

// The other actions' rethrow cases live in their own test files; editContact had none.
describe("editContact", () => {
  it("rethrows an error that is not an ApiError", async () => {
    vi.mocked(updateContact).mockRejectedValue(new TypeError("boom"));

    await expect(editContact("c1", "p1", initialFormState(), CONTACT)).rejects.toThrow("boom");
  });
});

describe("removeContact", () => {
  it("reports an unreachable API without revalidating", async () => {
    vi.mocked(deleteContact).mockRejectedValue(DOWN);

    const result = await removeContact("c1", "p1");

    expect(result).toMatchObject({ status: "error", formError: API_NOT_RUNNING_MESSAGE });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
