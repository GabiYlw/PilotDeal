import type { DealContext, PriorityScorer } from "../../scoring/priority-scorer.js";
import { DealClosedError, NotFoundError } from "../../shared/errors.js";
import {
  type Paginated,
  type Pagination,
  toPaginated,
  toSkipTake,
} from "../../shared/pagination.js";
import type { CompanyRepository } from "../companies/companies.repository.js";
import type { DealRepository } from "./deals.repository.js";
import type {
  CreateDealInput,
  Deal,
  DealListFilter,
  DealNextAction,
  DealStage,
  OpenDealStage,
  PrioritizedDeal,
  ScoringCandidate,
  UpdateDealData,
  UpdateDealInput,
} from "./deals.schemas.js";
import { isOpenStage } from "./deals.schemas.js";

const CLOSED_STAGES: ReadonlySet<DealStage> = new Set<DealStage>(["WON", "LOST"]);

export class DealService {
  constructor(
    private readonly dealRepository: DealRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly listScorer: PriorityScorer,
    private readonly actionScorer: PriorityScorer,
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

  // Scores every open deal in memory, sorts, then slices the requested page.
  async listPrioritized(pagination: Pagination): Promise<Paginated<PrioritizedDeal>> {
    const candidates = await this.dealRepository.listOpenForScoring();
    const scored = await Promise.all(candidates.map((candidate) => this.scoreCandidate(candidate)));
    const sorted = scored.filter((item) => item !== null).sort(comparePrioritized);
    const { skip, take } = toSkipTake(pagination);
    return toPaginated({ items: sorted.slice(skip, skip + take), total: sorted.length }, pagination);
  }

  async getNextAction(id: string): Promise<DealNextAction> {
    const candidate = await this.dealRepository.findByIdForScoring(id);
    if (!candidate) {
      throw dealNotFound(id);
    }
    const { stage } = candidate.deal;
    if (!isOpenStage(stage)) {
      throw new DealClosedError(`Deal ${id} is closed (${stage})`);
    }
    const result = await this.actionScorer.score(toDealContext(candidate, stage));
    return { dealId: id, ...result };
  }

  // Returns null for a closed deal (defensive: the query already excludes them).
  private async scoreCandidate(candidate: ScoringCandidate): Promise<PrioritizedDeal | null> {
    const { stage } = candidate.deal;
    if (!isOpenStage(stage)) {
      return null;
    }
    const priority = await this.listScorer.score(toDealContext(candidate, stage));
    return { deal: { ...candidate.deal, companyName: candidate.companyName }, priority };
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

function toDealContext(candidate: ScoringCandidate, stage: OpenDealStage): DealContext {
  const { deal } = candidate;
  return {
    deal: {
      id: deal.id,
      title: deal.title,
      value: deal.value,
      stage,
      expectedCloseDate: deal.expectedCloseDate,
      createdAt: deal.createdAt,
    },
    companyName: candidate.companyName,
    interactionCount: candidate.interactionCount,
    recentInteractions: candidate.recentInteractions,
  };
}

// Plain string comparison is valid for YYYY-MM-DD dates and for ids.
function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// A missing close date sorts last.
function compareCloseDates(a: string | null, b: string | null): number {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null);
  }
  return compareStrings(a, b);
}

// Score desc, then close date asc (no date last), then id asc.
function comparePrioritized(a: PrioritizedDeal, b: PrioritizedDeal): number {
  return (
    b.priority.score - a.priority.score ||
    compareCloseDates(a.deal.expectedCloseDate, b.deal.expectedCloseDate) ||
    compareStrings(a.deal.id, b.deal.id)
  );
}

function companyNotFound(companyId: string): NotFoundError {
  return new NotFoundError(`Company ${companyId} not found`);
}

function dealNotFound(id: string): NotFoundError {
  return new NotFoundError(`Deal ${id} not found`);
}
