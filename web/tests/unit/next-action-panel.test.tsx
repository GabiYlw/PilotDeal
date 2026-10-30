import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextActionPanel } from "@/components/deals/next-action-panel";
import { API_UNREACHABLE, ApiError, DEAL_CLOSED, getDealNextAction } from "@/lib/api";
import type { DealNextAction } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getDealNextAction: vi.fn(),
}));

const getDealNextActionMock = vi.mocked(getDealNextAction);

function result(factors: DealNextAction["factors"]): DealNextAction {
  return {
    dealId: "d1",
    score: 80,
    reason: "Because reasons.",
    nextAction: "Call them today.",
    factors,
    scoredBy: "rules",
  };
}

async function renderPanel() {
  render(await NextActionPanel({ dealId: "d1" }));
}

describe("NextActionPanel", () => {
  it("shows the next action, reason, score and factors", async () => {
    getDealNextActionMock.mockResolvedValue(result([{ name: "stage", points: 20 }]));

    await renderPanel();

    expect(screen.getByText("Call them today.")).toBeTruthy();
    expect(screen.getByText("Because reasons.")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("80");
    expect(screen.getByText("+20")).toBeTruthy();
    expect(screen.queryByText("Overdue")).toBeNull();
  });

  it("shows Overdue when the factors include closeDatePassed", async () => {
    getDealNextActionMock.mockResolvedValue(result([{ name: "closeDatePassed", points: 25 }]));

    await renderPanel();

    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  it("shows the closed notice without a score when the deal is closed", async () => {
    getDealNextActionMock.mockRejectedValue(new ApiError("closed", 409, DEAL_CLOSED));

    await renderPanel();

    expect(screen.getByText("This deal is closed")).toBeTruthy();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("shows the API hint when the API is unreachable", async () => {
    getDealNextActionMock.mockRejectedValue(new ApiError("down", 0, API_UNREACHABLE));

    await renderPanel();

    expect(screen.getByRole("alert").textContent).toContain("API is not running");
  });

  it("rethrows other API errors for error.tsx", async () => {
    getDealNextActionMock.mockRejectedValue(new ApiError("boom", 500, "INTERNAL_ERROR"));

    await expect(NextActionPanel({ dealId: "d1" })).rejects.toThrow("boom");
  });
});
