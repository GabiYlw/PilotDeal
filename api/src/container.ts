import Anthropic from "@anthropic-ai/sdk";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { AnthropicLlmClient } from "./ai/llm-client.js";
import type { Config } from "./config/env.js";
import { CompanyController } from "./modules/companies/companies.controller.js";
import { PrismaCompanyRepository } from "./modules/companies/companies.repository.js";
import { CompanyService } from "./modules/companies/companies.service.js";
import { ContactController } from "./modules/contacts/contacts.controller.js";
import { PrismaContactRepository } from "./modules/contacts/contacts.repository.js";
import { ContactService } from "./modules/contacts/contacts.service.js";
import { DealController } from "./modules/deals/deals.controller.js";
import { PrismaDealRepository } from "./modules/deals/deals.repository.js";
import { DealService } from "./modules/deals/deals.service.js";
import { HealthController } from "./modules/health/health.controller.js";
import { PrismaHealthRepository } from "./modules/health/health.repository.js";
import { HealthService } from "./modules/health/health.service.js";
import { InteractionController } from "./modules/interactions/interactions.controller.js";
import { PrismaInteractionRepository } from "./modules/interactions/interactions.repository.js";
import { InteractionService } from "./modules/interactions/interactions.service.js";
import { LlmScorer } from "./scoring/llm-scorer.js";
import type { PriorityScorer } from "./scoring/priority-scorer.js";
import { RuleBasedScorer } from "./scoring/rule-based-scorer.js";
import { type Clock, SystemClock } from "./shared/clock.js";
import { ConsoleLogger, type Logger } from "./shared/logger.js";

export interface Controllers {
  healthController: HealthController;
  companyController: CompanyController;
  contactController: ContactController;
  dealController: DealController;
  interactionController: InteractionController;
}

export interface Container {
  controllers: Controllers;
  disconnect(): Promise<void>;
}

// Tests can replace parts of the wiring, for example with a fixed clock.
export interface ContainerOverrides {
  clock?: Clock;
  logger?: Logger;
}

export interface PriorityScorers {
  listScorer: PriorityScorer;
  actionScorer: PriorityScorer;
}

// The only place that checks for an API key. The list scorer is always rule-based:
// one LLM call per listed deal would be slow and costly.
export function createPriorityScorers(config: Config, clock: Clock, logger: Logger): PriorityScorers {
  const ruleBasedScorer = new RuleBasedScorer(clock);
  return {
    listScorer: ruleBasedScorer,
    actionScorer: createActionScorer(config, ruleBasedScorer, clock, logger),
  };
}

function createActionScorer(
  config: Config,
  ruleBasedScorer: PriorityScorer,
  clock: Clock,
  logger: Logger,
): PriorityScorer {
  if (!config.anthropicApiKey) {
    return ruleBasedScorer;
  }
  const sdkClient = new Anthropic({ apiKey: config.anthropicApiKey });
  const llmClient = new AnthropicLlmClient(sdkClient, config.anthropicModel);
  return new LlmScorer(llmClient, ruleBasedScorer, clock, logger);
}

// The only place where classes are instantiated and wired together.
export function createContainer(config: Config, overrides: ContainerOverrides = {}): Container {
  const clock: Clock = overrides.clock ?? new SystemClock();
  const logger: Logger = overrides.logger ?? new ConsoleLogger();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });

  const healthRepository = new PrismaHealthRepository(prisma);
  const healthService = new HealthService(healthRepository);
  const healthController = new HealthController(healthService);

  const companyRepository = new PrismaCompanyRepository(prisma);
  const contactRepository = new PrismaContactRepository(prisma);
  const companyService = new CompanyService(companyRepository);
  const contactService = new ContactService(contactRepository, companyRepository);
  const companyController = new CompanyController(companyService);
  const contactController = new ContactController(contactService);

  const dealRepository = new PrismaDealRepository(prisma);
  const interactionRepository = new PrismaInteractionRepository(prisma);
  const { listScorer, actionScorer } = createPriorityScorers(config, clock, logger);
  const dealService = new DealService(dealRepository, companyRepository, listScorer, actionScorer);
  const interactionService = new InteractionService(interactionRepository, dealRepository);
  const dealController = new DealController(dealService);
  const interactionController = new InteractionController(interactionService);

  return {
    controllers: {
      healthController,
      companyController,
      contactController,
      dealController,
      interactionController,
    },
    disconnect: () => prisma.$disconnect(),
  };
}
