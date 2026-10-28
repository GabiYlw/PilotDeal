import { describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "../../src/modules/companies/companies.repository.js";
import type { Company } from "../../src/modules/companies/companies.schemas.js";
import type { ContactRepository } from "../../src/modules/contacts/contacts.repository.js";
import type { Contact } from "../../src/modules/contacts/contacts.schemas.js";
import { ContactService } from "../../src/modules/contacts/contacts.service.js";
import { NotFoundError } from "../../src/shared/errors.js";

function createContactRepository(): { [K in keyof ContactRepository]: ReturnType<typeof vi.fn> } {
  return {
    findById: vi.fn(),
    listByCompany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createCompanyRepository(): { [K in keyof CompanyRepository]: ReturnType<typeof vi.fn> } {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const companyId = "22222222-2222-4222-8222-222222222222";

const company: Company = {
  id: companyId,
  name: "Acme",
  industry: null,
  website: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const contact: Contact = {
  id: "33333333-3333-4333-8333-333333333333",
  companyId,
  name: "Jane Doe",
  email: null,
  phone: null,
  role: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function setup() {
  const contactRepository = createContactRepository();
  const companyRepository = createCompanyRepository();
  const service = new ContactService(
    contactRepository as unknown as ContactRepository,
    companyRepository as unknown as CompanyRepository,
  );
  return { contactRepository, companyRepository, service };
}

describe("ContactService", () => {
  describe("listForCompany", () => {
    it("throws NotFoundError without listing contacts when the company does not exist", async () => {
      const { contactRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(null);

      await expect(service.listForCompany(companyId, { page: 1, pageSize: 20 })).rejects.toThrow(
        new NotFoundError(`Company ${companyId} not found`),
      );
      expect(contactRepository.listByCompany).not.toHaveBeenCalled();
    });

    it("returns the paginated contacts when the company exists", async () => {
      const { contactRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(company);
      contactRepository.listByCompany.mockResolvedValue({ items: [contact], total: 1 });

      const result = await service.listForCompany(companyId, { page: 1, pageSize: 20 });

      expect(contactRepository.listByCompany).toHaveBeenCalledWith(companyId, {
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual({ data: [contact], meta: { page: 1, pageSize: 20, total: 1 } });
    });
  });

  describe("createForCompany", () => {
    it("throws NotFoundError without creating when the company does not exist", async () => {
      const { contactRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(null);

      await expect(service.createForCompany(companyId, { name: "Jane" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(contactRepository.create).not.toHaveBeenCalled();
    });

    it("passes the company id and input to the repository", async () => {
      const { contactRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(company);
      contactRepository.create.mockResolvedValue(contact);

      await expect(service.createForCompany(companyId, { name: "Jane Doe" })).resolves.toBe(contact);
      expect(contactRepository.create).toHaveBeenCalledWith(companyId, { name: "Jane Doe" });
    });

    it("throws NotFoundError when the company is deleted before the insert", async () => {
      const { contactRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(company);
      contactRepository.create.mockResolvedValue(null);

      await expect(service.createForCompany(companyId, { name: "Jane" })).rejects.toThrow(
        new NotFoundError(`Company ${companyId} not found`),
      );
    });
  });

  describe("getById", () => {
    it("returns the contact when it exists", async () => {
      const { contactRepository, service } = setup();
      contactRepository.findById.mockResolvedValue(contact);

      await expect(service.getById(contact.id)).resolves.toBe(contact);
    });

    it("throws NotFoundError when the contact does not exist", async () => {
      const { contactRepository, service } = setup();
      contactRepository.findById.mockResolvedValue(null);

      await expect(service.getById(contact.id)).rejects.toThrow(
        new NotFoundError(`Contact ${contact.id} not found`),
      );
    });
  });

  describe("update", () => {
    it("returns the updated contact", async () => {
      const { contactRepository, service } = setup();
      contactRepository.update.mockResolvedValue({ ...contact, role: "CTO" });

      const result = await service.update(contact.id, { role: "CTO" });

      expect(contactRepository.update).toHaveBeenCalledWith(contact.id, { role: "CTO" });
      expect(result.role).toBe("CTO");
    });

    it("throws NotFoundError when the contact does not exist", async () => {
      const { contactRepository, service } = setup();
      contactRepository.update.mockResolvedValue(null);

      await expect(service.update(contact.id, { role: "CTO" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("delete", () => {
    it("resolves when the contact is deleted", async () => {
      const { contactRepository, service } = setup();
      contactRepository.delete.mockResolvedValue(true);

      await expect(service.delete(contact.id)).resolves.toBeUndefined();
    });

    it("throws NotFoundError when the contact does not exist", async () => {
      const { contactRepository, service } = setup();
      contactRepository.delete.mockResolvedValue(false);

      await expect(service.delete(contact.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
