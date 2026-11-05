import { describe, expect, it, vi } from "vitest";
import type { DealRepository } from "../../src/modules/deals/deals.repository.js";
import type { InteractionEmbeddingService } from "../../src/modules/interactions/interaction-embeddings.service.js";
import type { InteractionRepository } from "../../src/modules/interactions/interactions.repository.js";
import type { Interaction } from "../../src/modules/interactions/interactions.schemas.js";
import { InteractionService } from "../../src/modules/interactions/interactions.service.js";
import { NotFoundError } from "../../src/shared/errors.js";

const interaction: Interaction = {
  id: "55555555-5555-4555-8555-555555555555",
  dealId: "44444444-4444-4444-8444-444444444444",
  type: "CALL",
  notes: "Discussed pricing",
  occurredAt: new Date("2026-01-02T00:00:00Z"),
  createdAt: new Date("2026-01-02T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

function setup() {
  const order: string[] = [];
  const interactionRepository = {
    create: vi.fn((): Promise<Interaction | null> => {
      order.push("create");
      return Promise.resolve(interaction);
    }),
    update: vi.fn((): Promise<Interaction | null> => Promise.resolve(interaction)),
  };
  const dealRepository = { findById: vi.fn().mockResolvedValue({ id: interaction.dealId }) };
  const interactionEmbeddings = {
    refreshEmbedding: vi.fn(() => {
      order.push("refresh");
      return Promise.resolve();
    }),
  };
  const service = new InteractionService(
    interactionRepository as unknown as InteractionRepository,
    dealRepository as unknown as DealRepository,
    interactionEmbeddings as unknown as InteractionEmbeddingService,
  );
  return { interactionRepository, dealRepository, interactionEmbeddings, service, order };
}

describe("InteractionService embeddings", () => {
  describe("createForDeal", () => {
    it("embeds the created interaction once, after the insert, and returns it", async () => {
      const { interactionEmbeddings, service, order } = setup();

      const result = await service.createForDeal(interaction.dealId, { type: "CALL", notes: "x" });

      expect(result).toBe(interaction);
      expect(interactionEmbeddings.refreshEmbedding).toHaveBeenCalledTimes(1);
      expect(interactionEmbeddings.refreshEmbedding).toHaveBeenCalledWith(interaction);
      expect(order).toEqual(["create", "refresh"]);
    });

    it("does not embed when the deal does not exist", async () => {
      const { dealRepository, interactionEmbeddings, service } = setup();
      dealRepository.findById.mockResolvedValue(null);

      await expect(
        service.createForDeal(interaction.dealId, { type: "NOTE", notes: "x" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(interactionEmbeddings.refreshEmbedding).not.toHaveBeenCalled();
    });

    it("does not embed when the deal is deleted before the insert", async () => {
      const { interactionRepository, interactionEmbeddings, service } = setup();
      interactionRepository.create.mockResolvedValue(null);

      await expect(
        service.createForDeal(interaction.dealId, { type: "NOTE", notes: "x" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(interactionEmbeddings.refreshEmbedding).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it.each([
      ["notes only", { notes: "New" }],
      ["notes and type", { notes: "New", type: "EMAIL" as const }],
      ["notes and occurredAt", { notes: "New", occurredAt: new Date("2026-02-01T00:00:00Z") }],
    ])("embeds the updated interaction when the input contains %s", async (_name, input) => {
      const { interactionEmbeddings, service } = setup();

      await service.update(interaction.id, input);

      expect(interactionEmbeddings.refreshEmbedding).toHaveBeenCalledTimes(1);
      expect(interactionEmbeddings.refreshEmbedding).toHaveBeenCalledWith(interaction);
    });

    it.each([
      ["only type", { type: "EMAIL" as const }],
      ["only occurredAt", { occurredAt: new Date("2026-02-01T00:00:00Z") }],
      [
        "type and occurredAt",
        { type: "EMAIL" as const, occurredAt: new Date("2026-02-01T00:00:00Z") },
      ],
    ])("does not embed when the input contains %s", async (_name, input) => {
      const { interactionEmbeddings, service } = setup();

      await service.update(interaction.id, input);

      expect(interactionEmbeddings.refreshEmbedding).not.toHaveBeenCalled();
    });

    it("does not embed when the interaction does not exist", async () => {
      const { interactionRepository, interactionEmbeddings, service } = setup();
      interactionRepository.update.mockResolvedValue(null);

      await expect(service.update(interaction.id, { notes: "x" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(interactionEmbeddings.refreshEmbedding).not.toHaveBeenCalled();
    });
  });
});
