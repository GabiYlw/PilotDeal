import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanyDeletedNotice } from "@/components/companies/company-deleted-notice";

async function renderNotice(params: Record<string, string | string[] | undefined>) {
  render(<>{await CompanyDeletedNotice({ searchParams: Promise.resolve(params) })}</>);
}

describe("CompanyDeletedNotice", () => {
  it("shows the message and a Dismiss link back to /clients", async () => {
    await renderNotice({ deleted: "1" });

    expect(screen.getByRole("status").textContent).toContain("Client deleted.");
    expect(screen.getByRole("link", { name: "Dismiss" }).getAttribute("href")).toBe("/clients");
  });

  it("explains when the company was already deleted", async () => {
    await renderNotice({ deleted: "already" });

    expect(screen.getByRole("status").textContent).toContain("This client was already deleted.");
  });

  it.each([{}, { deleted: "x" }, { deleted: ["1", "1"] }])(
    "renders nothing for %j",
    async (params) => {
      await renderNotice(params);

      expect(screen.queryByRole("status")).toBeNull();
    },
  );
});
