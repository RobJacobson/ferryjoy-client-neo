# AI Agent Architecture Research Memo

## Purpose

Capture research findings to frame planning for a ferry-focused AI assistant.
This is an engineering overview, not an implementation plan.

## Sources Reviewed

- Convex Agents docs: [docs.convex.dev/agents](https://docs.convex.dev/agents)
- Convex Agent component: [convex.dev/components/agent](https://www.convex.dev/components/agent)
- Convex article: [AI Agents with Built-in Memory](https://stack.convex.dev/ai-agents)
- TanStack AI overview: [tanstack.com/ai/latest](https://tanstack.com/ai/latest)
- TanStack Code Mode: [code-mode](https://tanstack.com/ai/latest/docs/code-mode/code-mode)
- TanStack Code Mode Skills:
  [code-mode-with-skills](https://tanstack.com/ai/latest/docs/code-mode/code-mode-with-skills)
- TanStack isolate drivers:
  [code-mode-isolates](https://tanstack.com/ai/latest/docs/code-mode/code-mode-isolates)
- TanStack adapters:
  [connection-adapters](https://tanstack.com/ai/latest/docs/chat/connection-adapters)
- Claude Skills:
  [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
- Cloudflare Code Mode:
  [Code Mode: the better way to use MCP](https://blog.cloudflare.com/code-mode/)
- Cloudflare Dynamic Workers:
  [Sandboxing AI agents, 100x faster](https://blog.cloudflare.com/dynamic-workers/)
- React Native streaming/EventSource context:
  [RN issue #25910](https://github.com/facebook/react-native/issues/25910),
  [RN discussion #99](https://github.com/react-native-community/discussions-and-proposals/issues/99),
  [Expo EventSource polyfill](https://www.npmjs.com/package/@falcondev-oss/expo-event-source-polyfill)

## Codebase Synopses

### `ferryjoy-client-neo`

- Expo + React Native app with Convex backend.
- Uses `ws-dottie` directly for WSDOT/WSF data access.
- Includes real-time vessel/schedule features and ML-related backend logic.
- Good fit for thin-client + server-side orchestration architecture.

### `ws-dottie`

- Type-safe wrapper over WSDOT/WSF APIs.
- Provides endpoint metadata and OpenAPI exports.
- Core asset for deterministic integrations and typed tool interfaces.

### `ws-dottie-mcp`

- MCP server that dynamically registers endpoint-level tools from
  `ws-dottie/apis`.
- Current surface is large (~97 tools), with rich per-tool descriptions.
- Main issue observed: context/token bloat and higher model tool-selection load.

## Key Findings

- The current MCP shape (many endpoint tools) creates real prompt pressure.
- "Meta-tools" only help if they truly reduce context requirements.
- For high-cardinality APIs, typed code execution against bindings is often
  better than sequential raw tool calls.
- Convex and TanStack are mostly complementary if responsibility boundaries are
  explicit.

## Tech Stack Roles and Fit

### Convex

- Durable workflows, agent threads/messages, reactivity, auth-aware tools.
- Strong choice for orchestrating long-running agent behavior and persistence.
- Not primarily marketed as an arbitrary model-authored code sandbox runtime.

### TanStack AI

- Unified model/tool API and robust streaming/client integration.
- Code Mode adds sandboxed model-authored TypeScript execution.
- Useful when you need compositional code-based tool orchestration.

### `ws-dottie`

- Canonical transportation data adapter layer.
- Should remain the source of truth for data contracts.

### Expo client

- Chat UX and visualization.
- Should remain thin; avoid pushing agent orchestration complexity to device.

## Complementary vs Either/Or

- **Convex + TanStack:** complementary in many architectures.
- **Either/or per responsibility:** avoid duplicate ownership of threads,
  routing, and tool execution policies.

Recommended framing:

- Convex owns memory/workflow/orchestration.
- `ws-dottie` owns transportation API integration.
- TanStack Code Mode (optional) owns sandboxed code execution.
- MCP is optional and best reserved for interoperability use cases.

## High-Level Integration Sketch

```ts
// Convex action (orchestrator shell)
export const answerTransportQuestion = action({
  args: { threadId: v.string(), prompt: v.string() },
  handler: async (ctx, { threadId, prompt }) => {
    const userContext = await ctx.runQuery(api.user.getContext, { threadId });
    const plan = await ctx.runAction(api.planner.planIntent, {
      prompt,
      userContext,
    });
    const response = await ctx.runAction(api.llm.renderResponse, {
      prompt,
      plan,
    });
    return { plan, text: response.text };
  },
});
```

```ts
// Optional TanStack Code Mode service boundary
const { tool, systemPrompt } = createCodeMode({
  driver: createNodeIsolateDriver({ timeout: 30_000, memoryLimit: 128 }),
  tools: [/* typed ws-dottie and domain tools */],
});
```

## Deterministic Planner Outline

1. Define strict input/output contracts.
2. Normalize multi-source data (`ws-dottie`, service alerts, optional weather).
3. Generate candidate sailings and itinerary timelines.
4. Reject infeasible options (deadline, outage, constraints).
5. Rank by risk, buffer, total travel time, and preferences.
6. Emit machine-readable reason codes and confidence/freshness metadata.
7. Let LLM explain deterministic output to the user.

This keeps trip advice explainable and testable while preserving conversational
UX.

## Responsibilities Matrix

| Capability | Convex | TanStack AI | `ws-dottie` | MCP |
| --- | --- | --- | --- | --- |
| Durable threads/messages | Primary | Optional | No | No |
| Reactive subscriptions | Primary | Client-side integration | No | No |
| Transportation API fetch contracts | Optional wrapper | Optional wrapper | Primary | Optional exposure |
| Multi-step business workflows | Primary | Optional | No | No |
| Sandboxed model-authored code execution | Not primary | Primary (Code Mode) | No | Not by itself |
| Tool interface interoperability across agent ecosystems | Optional | Optional | No | Primary |
| Deterministic trip planning logic | Primary | Optional helper | Input data source | Optional interface |
| Mobile/web chat UI | Via app integration | Strong helpers | No | No |

## Decision Checklist (for Planning Kickoff)

### Product/Behavior

- What outputs must be deterministic vs model-generated?
- What SLA/latency is acceptable for trip planning answers?
- Which user preferences are first-class inputs?

### Architecture

- Who owns thread state (Convex only, recommended)?
- Is sandboxed model-authored code needed in v1?
- Is MCP required for external interoperability in v1?

### Tool Surface

- Can endpoint-level tools be reduced to domain-level capabilities?
- Are capability docs loaded on demand instead of all at once?
- Are tool signatures typed end-to-end?

### Reliability/Safety

- How are stale or missing source datasets handled?
- How are retries/backoff and partial failures represented?
- How are secrets/network boundaries enforced for any sandbox runtime?

### Observability

- Do we log tool calls, planner reason codes, and data freshness?
- Can we replay production scenarios for deterministic regression tests?

## Additional Notes for Future Agents/Engineers

- Prefer typed API stubs over verbose free-form tool prose in prompt context.
- Keep deterministic planner logic isolated and well-tested.
- Treat MCP as an interoperability layer, not default orchestration substrate.
- Start with a narrow vertical slice and measure token, latency, and answer
  quality before expanding tool surfaces.

