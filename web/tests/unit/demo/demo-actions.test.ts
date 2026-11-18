// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCompany, editDeal, removeDeal, updateDealStage } from "@/demo/actions";
import { navigate } from "@/demo/navigation";
import { prioritizedDeals } from "@/demo/queries";
import { commit, resetDemoStore } from "@/demo/store";
import { initialFormState } from "@/lib/form-state";

vi.mock("@/demo/navigation", () => ({ navigate: vi.fn() }));

const navigateMock = vi.mocked(navigate);
const ALL = { page: 1, pageSize: 100 };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// The store's current state, read through a no-op change.
function current() {
  return commit((state) => ({ state, result: state }));
}

beforeEach(() => {
  resetDemoStore();
  navigateMock.mockReset();
});

describe("demo actions", () => {
  it("changes the stage in the store, which re-scores the deal", async () => {
    const result = await updateDealStage(
      "driver-mobile-app-pilot",
      initialFormState(),
      form({ stage: "NEGOTIATION" }),
    );

    expect(result.status).toBe("success");
    const state = current();
    const driver = prioritizedDeals(state, ALL, state.loadedAt).data.find(
      (item) => item.deal.id === "driver-mobile-app-pilot",
    );
    expect(driver?.deal.stage).toBe("NEGOTIATION");
  });

  it("returns the field error and the typed values when the form is invalid", async () => {
    const result = await editDeal(
      "driver-mobile-app-pilot",
      "northwind-logistics",
      initialFormState(),
      form({ title: "Driver app", value: "abc", expectedCloseDate: "" }),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: { value: "Value must be a number" },
      formError: undefined,
      values: { title: "Driver app", value: "abc", expectedCloseDate: "" },
    });
  });

  it("opens the new client's page after creating it", async () => {
    await addCompany(initialFormState(), form({ name: "Acme", industry: "", website: "" }));

    expect(navigateMock).toHaveBeenCalledWith("/clients/new-client-1");
  });

  it("deletes the deal and replaces the page with the list and its notice", async () => {
    await removeDeal("driver-mobile-app-pilot");

    expect(current().deletedIds.has("driver-mobile-app-pilot")).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith("/deals?deleted=1", { replace: true });
  });
});
