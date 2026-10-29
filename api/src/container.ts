import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
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
import type { PriorityScorer } from "./scoring/priority-scorer.js";
import { RuleBasedScorer } from "./scoring/rule-based-scorer.js";
import { type Clock, SystemClock } from "./shared/clock.js";

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
}

// The only place where classes are instantiated and wired together.
export function createContainer(config: Config, overrides: ContainerOverrides = {}): Container {
  const clock: Clock = overrides.clock ?? new SystemClock();
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
  // A future LlmScorer will be chosen here from config (config.anthropicApiKey).
  const priorityScorer: PriorityScorer = new RuleBasedScorer(clock);
  const dealService = new DealService(dealRepository, companyRepository, priorityScorer);
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
