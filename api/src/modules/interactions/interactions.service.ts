import { NotFoundError } from "../../shared/errors.js";
import { type Paginated, type Pagination, toPaginated } from "../../shared/pagination.js";
import type { DealRepository } from "../deals/deals.repository.js";
import type { InteractionRepository } from "./interactions.repository.js";
import type {
  CreateInteractionInput,
  Interaction,
  UpdateInteractionInput,
} from "./interactions.schemas.js";

export class InteractionService {
  constructor(
    private readonly interactionRepository: InteractionRepository,
    private readonly dealRepository: DealRepository,
  ) {}

  async listForDeal(dealId: string, pagination: Pagination): Promise<Paginated<Interaction>> {
    await this.ensureDealExists(dealId);
    return toPaginated(
      await this.interactionRepository.listByDeal(dealId, pagination),
      pagination,
    );
  }

  async createForDeal(dealId: string, input: CreateInteractionInput): Promise<Interaction> {
    await this.ensureDealExists(dealId);
    const interaction = await this.interactionRepository.create(dealId, input);
    if (!interaction) {
      // The deal was deleted between the check and the insert.
      throw dealNotFound(dealId);
    }
    return interaction;
  }

  async getById(id: string): Promise<Interaction> {
    const interaction = await this.interactionRepository.findById(id);
    if (!interaction) {
      throw interactionNotFound(id);
    }
    return interaction;
  }

  async update(id: string, input: UpdateInteractionInput): Promise<Interaction> {
    const interaction = await this.interactionRepository.update(id, input);
    if (!interaction) {
      throw interactionNotFound(id);
    }
    return interaction;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.interactionRepository.delete(id);
    if (!deleted) {
      throw interactionNotFound(id);
    }
  }

  private async ensureDealExists(dealId: string): Promise<void> {
    const deal = await this.dealRepository.findById(dealId);
    if (!deal) {
      throw dealNotFound(dealId);
    }
  }
}

function dealNotFound(dealId: string): NotFoundError {
  return new NotFoundError(`Deal ${dealId} not found`);
}

function interactionNotFound(id: string): NotFoundError {
  return new NotFoundError(`Interaction ${id} not found`);
}
