import { NotFoundError } from "../../shared/errors.js";
import { type Paginated, type Pagination, toPaginated } from "../../shared/pagination.js";
import type { CompanyRepository } from "../companies/companies.repository.js";
import type { DealRepository } from "./deals.repository.js";
import type {
  CreateDealInput,
  Deal,
  DealListFilter,
  DealStage,
  UpdateDealData,
  UpdateDealInput,
} from "./deals.schemas.js";

const CLOSED_STAGES: ReadonlySet<DealStage> = new Set<DealStage>(["WON", "LOST"]);

export class DealService {
  constructor(
    private readonly dealRepository: DealRepository,
    private readonly companyRepository: CompanyRepository,
  ) {}

  async listForCompany(companyId: string, pagination: Pagination): Promise<Paginated<Deal>> {
    await this.ensureCompanyExists(companyId);
    return toPaginated(await this.dealRepository.list({ companyId }, pagination), pagination);
  }

  async list(filter: DealListFilter, pagination: Pagination): Promise<Paginated<Deal>> {
    return toPaginated(await this.dealRepository.list(filter, pagination), pagination);
  }

  async createForCompany(companyId: string, input: CreateDealInput): Promise<Deal> {
    await this.ensureCompanyExists(companyId);
    const closedAt = isClosedStage(input.stage) ? new Date() : null;
    const deal = await this.dealRepository.create(companyId, { ...input, closedAt });
    if (!deal) {
      // The company was deleted between the check and the insert.
      throw companyNotFound(companyId);
    }
    return deal;
  }

  async getById(id: string): Promise<Deal> {
    const deal = await this.dealRepository.findById(id);
    if (!deal) {
      throw dealNotFound(id);
    }
    return deal;
  }

  async update(id: string, input: UpdateDealInput): Promise<Deal> {
    const data = await this.buildUpdateData(id, input);
    const deal = await this.dealRepository.update(id, data);
    if (!deal) {
      throw dealNotFound(id);
    }
    return deal;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.dealRepository.delete(id);
    if (!deleted) {
      throw dealNotFound(id);
    }
  }

  // closedAt depends on the previous stage, so the current deal is read only when
  // the stage is part of the update.
  private async buildUpdateData(id: string, input: UpdateDealInput): Promise<UpdateDealData> {
    if (input.stage === undefined) {
      return input;
    }
    const current = await this.dealRepository.findById(id);
    if (!current) {
      throw dealNotFound(id);
    }
    return withClosedAtForStageChange(current, { ...input, stage: input.stage });
  }

  private async ensureCompanyExists(companyId: string): Promise<void> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw companyNotFound(companyId);
    }
  }
}

function isClosedStage(stage: DealStage): boolean {
  return CLOSED_STAGES.has(stage);
}

function withClosedAtForStageChange(
  current: Deal,
  input: UpdateDealInput & { stage: DealStage },
): UpdateDealData {
  if (input.stage === current.stage) {
    return input;
  }
  if (isClosedStage(input.stage)) {
    return { ...input, closedAt: new Date() };
  }
  if (isClosedStage(current.stage)) {
    return { ...input, closedAt: null };
  }
  return input;
}

function companyNotFound(companyId: string): NotFoundError {
  return new NotFoundError(`Company ${companyId} not found`);
}

function dealNotFound(id: string): NotFoundError {
  return new NotFoundError(`Deal ${id} not found`);
}
