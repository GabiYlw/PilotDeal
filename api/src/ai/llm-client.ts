import type Anthropic from "@anthropic-ai/sdk";

export interface LlmTool {
  name: string;
  description: string;
  /** JSON Schema of the tool input; must have type "object". */
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties?: boolean;
  };
}

export interface LlmToolRequest {
  system: string;
  /** The single user message. */
  prompt: string;
  tool: LlmTool;
  maxTokens: number;
}

// Hides the SDK so callers (and tests) never depend on it.
export interface LlmClient {
  /** Forces Claude to call `request.tool` and resolves with the raw, UNVALIDATED tool input. */
  callTool(request: LlmToolRequest): Promise<unknown>;
}

// Never reaches HTTP, so it is a plain Error and not an AppError.
export class LlmResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmResponseError";
  }
}

export const LLM_TIMEOUT_MS = 15_000;
export const LLM_MAX_RETRIES = 1;

// Only the part of the SDK we use, so tests can pass a small fake.
export type AnthropicMessagesClient = Pick<Anthropic, "messages">;

export class AnthropicLlmClient implements LlmClient {
  constructor(
    private readonly client: AnthropicMessagesClient,
    private readonly model: string,
  ) {}

  // SDK errors (network, timeout, HTTP errors after the SDK's own retry) propagate unchanged.
  async callTool(request: LlmToolRequest): Promise<unknown> {
    const message = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        tools: [
          {
            name: request.tool.name,
            description: request.tool.description,
            input_schema: request.tool.inputSchema,
          },
        ],
        tool_choice: { type: "tool", name: request.tool.name },
      },
      { timeout: LLM_TIMEOUT_MS, maxRetries: LLM_MAX_RETRIES },
    );
    const block = message.content.find(
      (item) => item.type === "tool_use" && item.name === request.tool.name,
    );
    if (block?.type !== "tool_use") {
      throw new LlmResponseError(
        `Claude response did not contain a tool_use block for "${request.tool.name}" (stop_reason: ${String(message.stop_reason)})`,
      );
    }
    return block.input;
  }
}
