import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ApiHealth, HealthBadge } from "@/components/health-badge";
import { HealthStatus } from "@/components/health-status";
import { API_UNREACHABLE, ApiError, getHealth } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getHealth: vi.fn(),
}));

const getHealthMock = vi.mocked(getHealth);

describe("HealthBadge", () => {
  it.each<[string, ApiHealth, string]>([
    ["API and database up", { api: "up", database: "up" }, "API and database are up"],
    ["database down", { api: "up", database: "down" }, "API is up, database is down"],
    ["API down", { api: "down" }, "API is not running. Start it with npm --prefix api run dev."],
  ])("shows the %s message", (_name, health, message) => {
    render(<HealthBadge health={health} />);

    expect(screen.getByRole("status").textContent).toContain(message);
  });
});

// HealthStatus is an async Server Component: await it as a function, then render the element it returns.
describe("HealthStatus", () => {
  async function renderHealthStatus() {
    render(await HealthStatus());
    return screen.getByRole("status").textContent;
  }

  it("shows the database state reported by the API", async () => {
    getHealthMock.mockResolvedValue({ status: "error", database: "down" });

    expect(await renderHealthStatus()).toContain("database is down");
  });

  it("shows that the API is not running when the request fails", async () => {
    getHealthMock.mockRejectedValue(new ApiError("Cannot reach the API", 0, API_UNREACHABLE));

    expect(await renderHealthStatus()).toContain("API is not running");
  });

  it("rethrows errors that are not API errors, such as a missing API_URL", async () => {
    getHealthMock.mockRejectedValue(new Error("API_URL is not set"));

    await expect(HealthStatus()).rejects.toThrow("API_URL is not set");
  });
});
