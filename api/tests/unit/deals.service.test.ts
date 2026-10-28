import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "../../src/modules/companies/companies.repository.js";
import type { Company } from "../../src/modules/companies/companies.schemas.js";
import type { DealRepository } from "../../src/modules/deals/deals.repository.js";
import type { Deal, DealStage } from "../../src/modules/deals/deals.schemas.js";
import { DealService } from "../../src/modules/deals/deals.service.js";
import { NotFoundError } from "../../src/shared/errors.js";

function createDealRepository(): { [K in keyof DealRepository]: ReturnType<typeof vi.fn> } {
  return {
    findById: vi.fn(),
    list: vi.fn(),
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

const NOW = new Date("2026-06-15T12:00:00.000Z");
const companyId = "22222222-2222-4222-8222-222222222222";
const dealId = "44444444-4444-4444-8444-444444444444";
const pagination = { page: 1, pageSize: 20 };

const company: Company = {
  id: companyId,
  name: "Acme",
  industry: null,
  website: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function dealInStage(stage: DealStage): Deal {
  return {
    id: dealId,
    companyId,
    title: "Renewal",
    value: 1000,
    stage,
    expectedCloseDate: null,
    closedAt: stage === "WON" || stage === "LOST" ? new Date("2026-02-01T00:00:00Z") : null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function setup() {
  const dealRepository = createDealRepository();
  const companyRepository = createCompanyRepository();
  const service = new DealService(
    dealRepository as unknown as DealRepository,
    companyRepository as unknown as CompanyRepository,
  );
  return { dealRepository, companyRepository, service };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DealService", () => {
  describe("listForCompany", () => {
    it("throws NotFoundError without listing when the company does not exist", async () => {
      const { dealRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(null);

      await expect(service.listForCompany(companyId, pagination)).rejects.toThrow(
        new NotFoundError(`Company ${companyId} not found`),
      );
      expect(dealRepository.list).not.toHaveBeenCalled();
    });

    it("lists only the company's deals when the company exists", async () => {
      const { dealRepository, companyRepository, service } = setup();
      const deal = dealInStage("LEAD");
      companyRepository.findById.mockResolvedValue(company);
      dealRepository.list.mockResolvedValue({ items: [deal], total: 1 });

      const result = await service.listForCompany(companyId, pagination);

      expect(dealRepository.list).toHaveBeenCalledWith({ companyId }, pagination);
      expect(result).toEqual({ data: [deal], meta: { page: 1, pageSize: 20, total: 1 } });
    });
  });

  describe("list", () => {
    it("passes the filter through and returns the paginated result", async () => {
      const { dealRepository, service } = setup();
      const deal = dealInStage("WON");
      dealRepository.list.mockResolvedValue({ items: [deal], total: 7 });

      const result = await service.list({ stage: "WON", companyId }, pagination);

      expect(dealRepository.list).toHaveBeenCalledWith({ stage: "WON", companyId }, pagination);
      expect(result).toEqual({ data: [deal], meta: { page: 1, pageSize: 20, total: 7 } });
    });
  });

  describe("createForCompany", () => {
    it("throws NotFoundError without creating when the company does not exist", async () => {
      const { dealRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(null);

      await expect(
        service.createForCompany(companyId, { title: "T", value: 1, stage: "LEAD" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(dealRepository.create).not.toHaveBeenCalled();
    });

    it("leaves closedAt null for the default LEAD stage", async () => {
      const { dealRepository, companyRepository, service } = setup();
      const deal = dealInStage("LEAD");
      companyRepository.findById.mockResolvedValue(company);
      dealRepository.create.mockResolvedValue(deal);

      const input = { title: "Renewal", value: 1000, stage: "LEAD" as const };
      await expect(service.createForCompany(companyId, input)).resolves.toBe(deal);
      expect(dealRepository.create).toHaveBeenCalledWith(companyId, { ...input, closedAt: null });
    });

    it.each(["QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const)(
      "leaves closedAt null when created in the open stage %s",
      async (stage) => {
        const { dealRepository, companyRepository, service } = setup();
        companyRepository.findById.mockResolvedValue(company);
        dealRepository.create.mockResolvedValue(dealInStage(stage));

        await service.createForCompany(companyId, { title: "T", value: 1, stage });

        expect(dealRepository.create).toHaveBeenCalledWith(
          companyId,
          expect.objectContaining({ closedAt: null }),
        );
      },
    );

    it.each(["WON", "LOST"] as const)("sets closedAt to now when created as %s", async (stage) => {
      const { dealRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(company);
      dealRepository.create.mockResolvedValue(dealInStage(stage));

      await service.createForCompany(companyId, { title: "T", value: 1, stage });

      expect(dealRepository.create).toHaveBeenCalledWith(
        companyId,
        expect.objectContaining({ closedAt: NOW }),
      );
    });

    it("throws NotFoundError when the company is deleted before the insert", async () => {
      const { dealRepository, companyRepository, service } = setup();
      companyRepository.findById.mockResolvedValue(company);
      dealRepository.create.mockResolvedValue(null);

      await expect(
        service.createForCompany(companyId, { title: "T", value: 1, stage: "LEAD" }),
      ).rejects.toThrow(new NotFoundError(`Company ${companyId} not found`));
    });
  });

  describe("getById", () => {
    it("returns the deal when it exists", async () => {
      const { dealRepository, service } = setup();
      const deal = dealInStage("LEAD");
      dealRepository.findById.mockResolvedValue(deal);

      await expect(service.getById(dealId)).resolves.toBe(deal);
    });

    it("throws NotFoundError when the deal does not exist", async () => {
      const { dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(null);

      await expect(service.getById(dealId)).rejects.toThrow(
        new NotFoundError(`Deal ${dealId} not found`),
      );
    });
  });

  describe("update without stage", () => {
    it("does not read the current deal and passes the input through untouched", async () => {
      const { dealRepository, service } = setup();
      dealRepository.update.mockResolvedValue(dealInStage("WON"));

      await service.update(dealId, { title: "New" });

      expect(dealRepository.findById).not.toHaveBeenCalled();
      expect(dealRepository.update).toHaveBeenCalledWith(dealId, { title: "New" });
      expect(dealRepository.update.mock.calls[0]?.[1]).not.toHaveProperty("closedAt");
    });

    it("throws NotFoundError when the deal does not exist", async () => {
      const { dealRepository, service } = setup();
      dealRepository.update.mockResolvedValue(null);

      await expect(service.update(dealId, { title: "New" })).rejects.toThrow(
        new NotFoundError(`Deal ${dealId} not found`),
      );
    });
  });

  describe("update with stage", () => {
    it.each<[DealStage, DealStage, "now" | "null" | "unchanged"]>([
      ["LEAD", "WON", "now"],
      ["NEGOTIATION", "LOST", "now"],
      ["WON", "LEAD", "null"],
      ["WON", "NEGOTIATION", "null"],
      ["LOST", "QUALIFIED", "null"],
      ["LOST", "PROPOSAL", "null"],
      ["WON", "LOST", "now"],
      ["LOST", "WON", "now"],
      ["WON", "WON", "unchanged"],
      ["LOST", "LOST", "unchanged"],
      ["LEAD", "PROPOSAL", "unchanged"],
    ])("moving %s to %s sets closedAt: %s", async (from, to, expected) => {
      const { dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(dealInStage(from));
      dealRepository.update.mockResolvedValue(dealInStage(to));

      await service.update(dealId, { stage: to });

      const data: unknown = dealRepository.update.mock.calls[0]?.[1];
      if (expected === "unchanged") {
        expect(data).toEqual({ stage: to });
        expect(data).not.toHaveProperty("closedAt");
      } else {
        expect(data).toEqual({ stage: to, closedAt: expected === "now" ? NOW : null });
      }
    });

    it("throws NotFoundError without updating when the deal does not exist", async () => {
      const { dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(null);

      await expect(service.update(dealId, { stage: "WON" })).rejects.toThrow(
        new NotFoundError(`Deal ${dealId} not found`),
      );
      expect(dealRepository.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the deal is deleted between the read and the update", async () => {
      const { dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(dealInStage("LEAD"));
      dealRepository.update.mockResolvedValue(null);

      await expect(service.update(dealId, { stage: "WON" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("passes the other fields through together with closedAt", async () => {
      const { dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(dealInStage("LEAD"));
      dealRepository.update.mockResolvedValue(dealInStage("WON"));

      await service.update(dealId, { stage: "WON", title: "Signed", value: 5 });

      expect(dealRepository.update).toHaveBeenCalledWith(dealId, {
        stage: "WON",
        title: "Signed",
        value: 5,
        closedAt: NOW,
      });
    });
  });

  describe("delete", () => {
    it("resolves when the deal is deleted", async () => {
      const { dealRepository, service } = setup();
      dealRepository.delete.mockResolvedValue(true);

      await expect(service.delete(dealId)).resolves.toBeUndefined();
    });

    it("throws NotFoundError when the deal does not exist", async () => {
      const { dealRepository, service } = setup();
      dealRepository.delete.mockResolvedValue(false);

      await expect(service.delete(dealId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
