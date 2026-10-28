import { describe, expect, it, vi } from "vitest";
import type { DealRepository } from "../../src/modules/deals/deals.repository.js";
import type { Deal } from "../../src/modules/deals/deals.schemas.js";
import type { InteractionRepository } from "../../src/modules/interactions/interactions.repository.js";
import type { Interaction } from "../../src/modules/interactions/interactions.schemas.js";
import { InteractionService } from "../../src/modules/interactions/interactions.service.js";
import { NotFoundError } from "../../src/shared/errors.js";

function createInteractionRepository(): {
  [K in keyof InteractionRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findById: vi.fn(),
    listByDeal: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createDealRepository(): { [K in keyof DealRepository]: ReturnType<typeof vi.fn> } {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const dealId = "44444444-4444-4444-8444-444444444444";
const pagination = { page: 1, pageSize: 20 };

const deal: Deal = {
  id: dealId,
  companyId: "22222222-2222-4222-8222-222222222222",
  title: "Renewal",
  value: 1000,
  stage: "LEAD",
  expectedCloseDate: null,
  closedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const interaction: Interaction = {
  id: "55555555-5555-4555-8555-555555555555",
  dealId,
  type: "CALL",
  notes: "Discussed pricing",
  occurredAt: new Date("2026-01-02T00:00:00Z"),
  createdAt: new Date("2026-01-02T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

function setup() {
  const interactionRepository = createInteractionRepository();
  const dealRepository = createDealRepository();
  const service = new InteractionService(
    interactionRepository as unknown as InteractionRepository,
    dealRepository as unknown as DealRepository,
  );
  return { interactionRepository, dealRepository, service };
}

describe("InteractionService", () => {
  describe("listForDeal", () => {
    it("throws NotFoundError without listing when the deal does not exist", async () => {
      const { interactionRepository, dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(null);

      await expect(service.listForDeal(dealId, pagination)).rejects.toThrow(
        new NotFoundError(`Deal ${dealId} not found`),
      );
      expect(interactionRepository.listByDeal).not.toHaveBeenCalled();
    });

    it("returns the paginated interactions when the deal exists", async () => {
      const { interactionRepository, dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(deal);
      interactionRepository.listByDeal.mockResolvedValue({ items: [interaction], total: 1 });

      const result = await service.listForDeal(dealId, pagination);

      expect(interactionRepository.listByDeal).toHaveBeenCalledWith(dealId, pagination);
      expect(result).toEqual({ data: [interaction], meta: { page: 1, pageSize: 20, total: 1 } });
    });
  });

  describe("createForDeal", () => {
    it("throws NotFoundError without creating when the deal does not exist", async () => {
      const { interactionRepository, dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(null);

      await expect(
        service.createForDeal(dealId, { type: "NOTE", notes: "x" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(interactionRepository.create).not.toHaveBeenCalled();
    });

    it("passes the deal id and input to the repository", async () => {
      const { interactionRepository, dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(deal);
      interactionRepository.create.mockResolvedValue(interaction);
      const input = { type: "CALL" as const, notes: "Discussed pricing" };

      await expect(service.createForDeal(dealId, input)).resolves.toBe(interaction);
      expect(interactionRepository.create).toHaveBeenCalledWith(dealId, input);
    });

    it("throws NotFoundError when the deal is deleted before the insert", async () => {
      const { interactionRepository, dealRepository, service } = setup();
      dealRepository.findById.mockResolvedValue(deal);
      interactionRepository.create.mockResolvedValue(null);

      await expect(service.createForDeal(dealId, { type: "NOTE", notes: "x" })).rejects.toThrow(
        new NotFoundError(`Deal ${dealId} not found`),
      );
    });
  });

  describe("getById", () => {
    it("returns the interaction when it exists", async () => {
      const { interactionRepository, service } = setup();
      interactionRepository.findById.mockResolvedValue(interaction);

      await expect(service.getById(interaction.id)).resolves.toBe(interaction);
    });

    it("throws NotFoundError when the interaction does not exist", async () => {
      const { interactionRepository, service } = setup();
      interactionRepository.findById.mockResolvedValue(null);

      await expect(service.getById(interaction.id)).rejects.toThrow(
        new NotFoundError(`Interaction ${interaction.id} not found`),
      );
    });
  });

  describe("update", () => {
    it("returns the updated interaction", async () => {
      const { interactionRepository, service } = setup();
      interactionRepository.update.mockResolvedValue({ ...interaction, notes: "Updated" });

      const result = await service.update(interaction.id, { notes: "Updated" });

      expect(interactionRepository.update).toHaveBeenCalledWith(interaction.id, {
        notes: "Updated",
      });
      expect(result.notes).toBe("Updated");
    });

    it("throws NotFoundError when the interaction does not exist", async () => {
      const { interactionRepository, service } = setup();
      interactionRepository.update.mockResolvedValue(null);

      await expect(service.update(interaction.id, { notes: "x" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("delete", () => {
    it("resolves when the interaction is deleted", async () => {
      const { interactionRepository, service } = setup();
      interactionRepository.delete.mockResolvedValue(true);

      await expect(service.delete(interaction.id)).resolves.toBeUndefined();
    });

    it("throws NotFoundError when the interaction does not exist", async () => {
      const { interactionRepository, service } = setup();
      interactionRepository.delete.mockResolvedValue(false);

      await expect(service.delete(interaction.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
