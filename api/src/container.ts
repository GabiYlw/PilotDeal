import Anthropic from "@anthropic-ai/sdk";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { type AnswerGenerator, NoAnswerGenerator } from "./ai/answer-generator.js";
import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from "./ai/embedding-provider.js";
import { AnthropicLlmClient, type LlmClient } from "./ai/llm-client.js";
import { LlmAnswerGenerator } from "./ai/llm-answer-generator.js";
import { LOCAL_EMBEDDING_MODEL, LocalEmbeddingProvider } from "./ai/local-embedding-provider.js";
import { loadTransformersExtractor } from "./ai/transformers-extractor.js";
import type { Config } from "./config/env.js";
import { AskController } from "./modules/ask/ask.controller.js";
import { PrismaAskRepository } from "./modules/ask/ask.repository.js";
import { AskService } from "./modules/ask/ask.service.js";
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
import { InteractionEmbeddingService } from "./modules/interactions/interaction-embeddings.service.js";
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
  askController: AskController;
}

export interface Container {
  controllers: Controllers;
  interactionEmbeddings: InteractionEmbeddingService;
  disconnect(): Promise<void>;
}

// Tests can replace parts of the wiring, for example with a fixed clock.
export interface ContainerOverrides {
  clock?: Clock;
  logger?: Logger;
  embeddingProvider?: EmbeddingProvider;
  // Tests inject a fake so they never reach Claude.
  llmClient?: LlmClient;
}

export interface PriorityScorers {
  listScorer: PriorityScorer;
  actionScorer: PriorityScorer;
}

// The only place that checks for an API key and builds the SDK.
export function createLlmClient(config: Config): LlmClient | undefined {
  if (!config.anthropicApiKey) {
    return undefined;
  }
  const sdkClient = new Anthropic({ apiKey: config.anthropicApiKey });
  return new AnthropicLlmClient(sdkClient, config.anthropicModel);
}

// Without an LLM client the answer step is skipped and /ask returns sources only.
export function createAnswerGenerator(
  llmClient: LlmClient | undefined,
  clock: Clock,
  logger: Logger,
): AnswerGenerator {
  return llmClient ? new LlmAnswerGenerator(llmClient, clock, logger) : new NoAnswerGenerator();
}

// The list scorer is always rule-based: one LLM call per listed deal would be slow and costly.
export function createPriorityScorers(
  llmClient: LlmClient | undefined,
  clock: Clock,
  logger: Logger,
): PriorityScorers {
  const ruleBasedScorer = new RuleBasedScorer(clock);
  return {
    listScorer: ruleBasedScorer,
    actionScorer: createActionScorer(llmClient, ruleBasedScorer, clock, logger),
  };
}

// The single place to switch embedding providers. The model is loaded lazily on the first embed().
export function createEmbeddingProvider(): EmbeddingProvider {
  return new LocalEmbeddingProvider(loadTransformersExtractor, LOCAL_EMBEDDING_MODEL);
}

// Fail fast: a provider with another size would make every vector write fail.
function assertEmbeddingDimensions(provider: EmbeddingProvider): void {
  if (provider.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding provider has ${provider.dimensions} dimensions, but the database column is vector(${EMBEDDING_DIMENSIONS})`,
    );
  }
}

function createActionScorer(
  llmClient: LlmClient | undefined,
  ruleBasedScorer: PriorityScorer,
  clock: Clock,
  logger: Logger,
): PriorityScorer {
  return llmClient ? new LlmScorer(llmClient, ruleBasedScorer, clock, logger) : ruleBasedScorer;
}

// The only place where classes are instantiated and wired together.
export function createContainer(config: Config, overrides: ContainerOverrides = {}): Container {
  const clock: Clock = overrides.clock ?? new SystemClock();
  const logger: Logger = overrides.logger ?? new ConsoleLogger();
  const embeddingProvider = overrides.embeddingProvider ?? createEmbeddingProvider();
  assertEmbeddingDimensions(embeddingProvider);
  const llmClient = overrides.llmClient ?? createLlmClient(config);
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
  const { listScorer, actionScorer } = createPriorityScorers(llmClient, clock, logger);
  const dealService = new DealService(dealRepository, companyRepository, listScorer, actionScorer);
  const interactionEmbeddings = new InteractionEmbeddingService(
    interactionRepository,
    embeddingProvider,
    logger,
  );
  const interactionService = new InteractionService(
    interactionRepository,
    dealRepository,
    interactionEmbeddings,
  );
  const dealController = new DealController(dealService);
  const interactionController = new InteractionController(interactionService);

  const askRepository = new PrismaAskRepository(prisma);
  const answerGenerator = createAnswerGenerator(llmClient, clock, logger);
  const askService = new AskService(
    askRepository,
    dealRepository,
    embeddingProvider,
    answerGenerator,
    logger,
  );
  const askController = new AskController(askService);

  return {
    controllers: {
      healthController,
      companyController,
      contactController,
      dealController,
      interactionController,
      askController,
    },
    interactionEmbeddings,
    disconnect: () => prisma.$disconnect(),
  };
}
