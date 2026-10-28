import { describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "../../src/modules/companies/companies.repository.js";
import type { Company } from "../../src/modules/companies/companies.schemas.js";
import { CompanyService } from "../../src/modules/companies/companies.service.js";
import { NotFoundError } from "../../src/shared/errors.js";

function createRepository(): { [K in keyof CompanyRepository]: ReturnType<typeof vi.fn> } {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const company: Company = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme",
  industry: null,
  website: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function setup() {
  const repository = createRepository();
  const service = new CompanyService(repository as unknown as CompanyRepository);
  return { repository, service };
}

describe("CompanyService", () => {
  it("lists companies with pagination meta", async () => {
    const { repository, service } = setup();
    repository.list.mockResolvedValue({ items: [company], total: 7 });

    const result = await service.list({ page: 2, pageSize: 5 });

    expect(repository.list).toHaveBeenCalledWith({ page: 2, pageSize: 5 });
    expect(result).toEqual({ data: [company], meta: { page: 2, pageSize: 5, total: 7 } });
  });

  it("returns a company by id", async () => {
    const { repository, service } = setup();
    repository.findById.mockResolvedValue(company);

    await expect(service.getById(company.id)).resolves.toBe(company);
  });

  it("throws NotFoundError when getting a company that does not exist", async () => {
    const { repository, service } = setup();
    repository.findById.mockResolvedValue(null);

    await expect(service.getById(company.id)).rejects.toThrow(
      new NotFoundError(`Company ${company.id} not found`),
    );
  });

  it("passes the input through when creating a company", async () => {
    const { repository, service } = setup();
    repository.create.mockResolvedValue(company);

    await expect(service.create({ name: "Acme" })).resolves.toBe(company);
    expect(repository.create).toHaveBeenCalledWith({ name: "Acme" });
  });

  it("returns the updated company", async () => {
    const { repository, service } = setup();
    repository.update.mockResolvedValue({ ...company, industry: "Retail" });

    const result = await service.update(company.id, { industry: "Retail" });

    expect(repository.update).toHaveBeenCalledWith(company.id, { industry: "Retail" });
    expect(result.industry).toBe("Retail");
  });

  it("throws NotFoundError when updating a company that does not exist", async () => {
    const { repository, service } = setup();
    repository.update.mockResolvedValue(null);

    await expect(service.update(company.id, { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("resolves when deleting an existing company", async () => {
    const { repository, service } = setup();
    repository.delete.mockResolvedValue(true);

    await expect(service.delete(company.id)).resolves.toBeUndefined();
  });

  it("throws NotFoundError when deleting a company that does not exist", async () => {
    const { repository, service } = setup();
    repository.delete.mockResolvedValue(false);

    await expect(service.delete(company.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
