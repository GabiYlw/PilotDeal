import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DealDeletedNotice } from "@/components/deals/deal-deleted-notice";

async function renderNotice(params: Record<string, string | string[] | undefined>) {
  render(<>{await DealDeletedNotice({ searchParams: Promise.resolve(params) })}</>);
}

describe("DealDeletedNotice", () => {
  it("shows the message and a Dismiss link back to /deals", async () => {
    await renderNotice({ deleted: "1" });

    expect(screen.getByRole("status").textContent).toContain("Deal deleted.");
    expect(screen.getByRole("link", { name: "Dismiss" }).getAttribute("href")).toBe("/deals");
  });

  it("explains when the deal was already deleted", async () => {
    await renderNotice({ deleted: "already" });

    expect(screen.getByRole("status").textContent).toContain("This deal was already deleted.");
  });

  it("renders nothing without the deleted param", async () => {
    await renderNotice({});

    expect(screen.queryByRole("status")).toBeNull();
  });
});
