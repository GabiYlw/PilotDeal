import type { LlmClient, LlmToolRequest } from "../../src/ai/llm-client.js";

// Records every request and answers with a canned tool input or a failure. Never reaches Claude.
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmToolRequest[] = [];
  private result: unknown = undefined;
  private failure: { error: unknown } | null = null;

  respondWith(input: unknown): void {
    this.result = input;
    this.failure = null;
  }

  failWith(error: unknown = new Error("Fake LLM failure")): void {
    this.failure = { error };
  }

  reset(): void {
    this.requests.length = 0;
    this.result = undefined;
    this.failure = null;
  }

  callTool(request: LlmToolRequest): Promise<unknown> {
    this.requests.push(request);
    if (this.failure) {
      // Rejects with any value on purpose: the SDK can throw non-Error values.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(this.failure.error);
    }
    return Promise.resolve(this.result);
  }
}
