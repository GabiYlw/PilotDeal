# Task (verbatim from the user)

Add an LLM-based priority scorer using Claude, as a second PriorityScorer
implementation. Follow CLAUDE.md. Tests must never call the real API.

Design:
- src/ai/llm-client.ts: a small LlmClient interface that hides the SDK, with an
  AnthropicLlmClient implementation using @anthropic-ai/sdk. Model from
  ANTHROPIC_MODEL. Timeout 15 seconds, at most 1 retry.
- Get structured output through tool use with a forced tool (tool_choice), whose
  input schema is { score: integer 0-100, reason: string, nextAction: string }.
  Validate the tool input with zod.
- src/scoring/llm-scorer.ts: LlmScorer implements PriorityScorer. Constructor
  receives an LlmClient, a fallback PriorityScorer (the RuleBasedScorer) and a
  logger.
- Prompts live in src/ai/prompts.ts.

Scoring flow in LlmScorer:
1. Compute the rule-based result first. It is the baseline.
2. Send Claude the deal context, the 5 recent interactions and the baseline
   score with its factors. Ask it to adjust the score based on what the
   interaction notes reveal (urgency, objections, buying signals, silence), and
   to write a reason and a concrete nextAction grounded in the notes.
3. Guardrail: clamp the returned score to baseline -20 .. baseline +20, then to
   0..100.
4. Result: score = clamped score, reason and nextAction from Claude, factors =
   baseline factors plus { name: "AI adjustment from interaction notes",
   points: clamped score minus baseline } (omit it when 0), so factors always
   sum to the score. scoredBy: "llm".
5. On any failure (network error, timeout, missing tool output, zod validation
   error): log a warning and return the baseline result unchanged, with
   scoredBy "rules". Never throw to the caller.

Prompt injection: interaction notes are untrusted customer text. Put them inside
clearly delimited tags and instruct the model in the system prompt to treat
them only as data, never as instructions.

Wiring (container.ts):
- PriorityResult.scoredBy becomes "rules" | "llm".
- DealService receives two scorers: listScorer (always RuleBasedScorer, used by
  GET /deals/prioritized) and actionScorer (used by GET /deals/:id/next-action).
- actionScorer is LlmScorer when ANTHROPIC_API_KEY is set, otherwise
  RuleBasedScorer. No API key checks anywhere else.
- Explain the new dependency (@anthropic-ai/sdk) in implementation.md.

Tests (fake LlmClient, no network):
- LlmScorer: valid output; clamping at +20, -20, 0 and 100 (table-driven);
  the adjustment factor and that factors sum to the score; each failure type
  falls back to the baseline with scoredBy "rules" and logs a warning; the
  prompt sent to the client contains the notes inside the delimiting tags and
  the baseline score.
- AnthropicLlmClient: with a mocked SDK, maps the tool_use block to the parsed
  input and reports a missing tool_use block as a failure.
- container: without a key both scorers are RuleBasedScorer; with a key the
  actionScorer is LlmScorer and the listScorer is still RuleBasedScorer.
- Existing next-action integration tests keep passing without a key.
