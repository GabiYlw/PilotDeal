import type { Config } from "../../src/config/env.js";
import { type Container, type ContainerOverrides, createContainer } from "../../src/container.js";
import { FakeEmbeddingProvider } from "../support/fake-embedding-provider.js";

// Every integration test builds its container here, so no test can load the real embedding model.
// A test that needs to control the fake passes its own instance in overrides.embeddingProvider.
export function createTestContainer(config: Config, overrides: ContainerOverrides = {}): Container {
  return createContainer(config, { embeddingProvider: new FakeEmbeddingProvider(), ...overrides });
}
