import { describe, expect, it, vi } from "vitest";
import {
  AnthropicLlmClient,
  LlmResponseError,
  type AnthropicMessagesClient,
  type LlmToolRequest,
} from "../../src/ai/llm-client.js";

const request: LlmToolRequest = {
  system: "sys",
  prompt: "hello",
  maxTokens: 123,
  tool: {
    name: "my_tool",
    description: "desc",
    inputSchema: { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
  },
};

function setup() {
  const create = vi.fn();
  const sdk = { messages: { create } } as unknown as AnthropicMessagesClient;
  return { client: new AnthropicLlmClient(sdk, "test-model"), create };
}

describe("AnthropicLlmClient", () => {
  it("returns the input of the matching tool_use block", async () => {
    const { client, create } = setup();
    const input = { a: "x" };
    create.mockResolvedValue({
      stop_reason: "tool_use",
      content: [
        { type: "text", text: "thinking" },
        { type: "tool_use", id: "toolu_1", name: "other", input: { a: "wrong" } },
        { type: "tool_use", id: "toolu_2", name: "my_tool", input },
      ],
    });

    await expect(client.callTool(request)).resolves.toBe(input);
  });

  it("forces the tool and sends model, limits and per-request options", async () => {
    const { client, create } = setup();
    create.mockResolvedValue({
      content: [{ type: "tool_use", id: "t", name: "my_tool", input: {} }],
    });

    await client.callTool(request);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      {
        model: "test-model",
        max_tokens: 123,
        system: "sys",
        messages: [{ role: "user", content: "hello" }],
        tools: [{ name: "my_tool", description: "desc", input_schema: request.tool.inputSchema }],
        tool_choice: { type: "tool", name: "my_tool" },
      },
      { timeout: 15000, maxRetries: 1 },
    );
  });

  it.each<[string, unknown[]]>([
    ["only text", [{ type: "text", text: "no tool" }]],
    ["empty content", []],
    [
      "a tool_use block with another name",
      [{ type: "tool_use", id: "t", name: "other", input: {} }],
    ],
  ])("rejects with LlmResponseError when the response has %s", async (_name, content) => {
    const { client, create } = setup();
    create.mockResolvedValue({ stop_reason: "max_tokens", content });

    const promise = client.callTool(request);

    await expect(promise).rejects.toBeInstanceOf(LlmResponseError);
    await expect(promise).rejects.toThrow(
      'Claude response did not contain a tool_use block for "my_tool" (stop_reason: max_tokens)',
    );
  });

  it("propagates SDK errors unchanged", async () => {
    const { client, create } = setup();
    const error = new Error("Request timed out.");
    create.mockRejectedValue(error);

    await expect(client.callTool(request)).rejects.toBe(error);
  });
});
