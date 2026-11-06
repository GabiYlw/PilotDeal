import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

// The request-time parts fetch from the API; they have their own tests.
vi.mock("@/components/health-status", () => ({ HealthStatus: () => null }));
vi.mock("@/components/home-stats", () => ({
  HomeStats: () => null,
  HomeStatsSkeleton: () => null,
}));

describe("HomePage", () => {
  it("links to the source on GitHub in a new tab", () => {
    render(<HomePage />);

    const link = screen.getByRole("link", { name: /View the source on GitHub/ });
    expect(link.getAttribute("href")).toBe("https://github.com/GabiYlw/PilotDeal");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("(opens in a new tab)");
  });

  it("shows the architecture diagram instead of a placeholder", () => {
    render(<HomePage />);

    expect(screen.getByRole("figure")).toBeTruthy();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("starts with the headline and its actions, without an eyebrow pill", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Know which deal to work on next." }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "View deals" }).getAttribute("href")).toBe("/deals");
    expect(screen.queryByText("AI-assisted mini CRM")).toBeNull();
  });
});
