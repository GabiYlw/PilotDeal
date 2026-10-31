import { describe, expect, it } from "vitest";
import { contactsVersion, pageVersion } from "@/lib/page-version";

const DEAL = { updatedAt: "2026-10-01T00:00:00.000Z" };
const A = { id: "a", updatedAt: "2026-10-02T00:00:00.000Z" };
const B = { id: "b", updatedAt: "2026-10-03T00:00:00.000Z" };
const BASE = pageVersion(DEAL, [A, B], 2);

describe("pageVersion", () => {
  it("is stable for the same data", () => {
    expect(pageVersion({ ...DEAL }, [{ ...A }, { ...B }], 2)).toBe(BASE);
  });

  it.each([
    ["a stage update", pageVersion({ updatedAt: "2026-10-09T00:00:00.000Z" }, [A, B], 2)],
    ["an interaction edit", pageVersion(DEAL, [{ ...A, updatedAt: "2026-10-09T00:00:00.000Z" }, B], 2)],
    ["an interaction delete", pageVersion(DEAL, [B], 1)],
    ["an interaction add", pageVersion(DEAL, [{ id: "c", updatedAt: A.updatedAt }, A, B], 3)],
    ["an add beyond the listed page", pageVersion(DEAL, [A, B], 3)],
  ])("changes after %s", (_name, version) => {
    expect(version).not.toBe(BASE);
  });
});

describe("contactsVersion", () => {
  const CONTACTS_BASE = contactsVersion([A, B], 2);

  it("is stable for the same contacts", () => {
    expect(contactsVersion([{ ...A }, { ...B }], 2)).toBe(CONTACTS_BASE);
  });

  it.each([
    ["a contact edit", contactsVersion([{ ...A, updatedAt: "2026-10-09T00:00:00.000Z" }, B], 2)],
    ["a contact delete", contactsVersion([B], 1)],
    ["a contact add", contactsVersion([{ id: "c", updatedAt: A.updatedAt }, A, B], 3)],
  ])("changes after %s", (_name, version) => {
    expect(version).not.toBe(CONTACTS_BASE);
  });
});
