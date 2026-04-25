# Route Timeline Frontend Context Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-stage-1-handoff.md](./2026-04-25-route-timeline-stage-1-handoff.md)
- [2026-04-25-route-timeline-stage-2-handoff.md](./2026-04-25-route-timeline-stage-2-handoff.md)
- [2026-04-25-route-timeline-stage-3-handoff.md](./2026-04-25-route-timeline-stage-3-handoff.md)

## Purpose

Implement the next route timeline step: a frontend Convex-backed context that
loads and caches `RouteTimelineSnapshot` data for selected route and
`SailingDay` scopes.

The backend read model is now in place. This stage should make the data
available to frontend features without yet refactoring `VesselTimeline` or
building new trip timeline UI.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)

Review backend contracts:

- [convex/functions/routeTimeline/schemas.ts](../../convex/functions/routeTimeline/schemas.ts)
- [convex/functions/routeTimeline/queries.ts](../../convex/functions/routeTimeline/queries.ts)
- [convex/domain/routeTimeline/buildRouteTimelineSnapshot.ts](../../convex/domain/routeTimeline/buildRouteTimelineSnapshot.ts)

Review existing frontend context patterns:

- [src/data/contexts/convex/ConvexUnifiedTripsContext.tsx](../../src/data/contexts/convex/ConvexUnifiedTripsContext.tsx)
- [src/data/contexts/index.ts](../../src/data/contexts/index.ts)

## Implementation Scope

Expected files:

- `src/data/contexts/convex/ConvexRouteTimelineContext.tsx`
- `src/data/contexts/index.ts`

Optional tests may be added if there is a simple local pattern for context
selectors or conversion helpers. Do not overbuild test scaffolding just to test
React provider plumbing.

## Context Contract

Create a provider and hook for route timeline snapshots.

Suggested exported API:

```ts
type ConvexRouteTimelineProviderProps = PropsWithChildren<{
  routeAbbrev: string;
  sailingDay: string;
  vesselAbbrev?: string;
  windowStart?: Date;
  windowEnd?: Date;
}>;

export const ConvexRouteTimelineProvider = (...)
export const useConvexRouteTimeline = (...)
```

The context value should expose:

- `routeAbbrev`
- `sailingDay`
- optional `vesselAbbrev`
- optional `windowStart`
- optional `windowEnd`
- `snapshot`
- `vessels`
- `isLoading`
- `errorMessage` or `error`

Keep the exact naming consistent with nearby contexts.

## Query Usage

Use the new backend query:

```ts
api.functions.routeTimeline.queries.getRouteTimelineSnapshot
```

If the generated API does not yet include this path locally, run the repo's
Convex codegen command before implementing or verifying:

```sh
bun run convex:codegen
```

The query args should remain wire-shaped:

```ts
{
  RouteAbbrev: routeAbbrev,
  SailingDay: sailingDay,
  VesselAbbrev: vesselAbbrev,
  WindowStart: windowStart?.getTime(),
  WindowEnd: windowEnd?.getTime(),
}
```

Convert the query result using:

```ts
toDomainRouteTimelineSnapshot
```

from `convex/functions/routeTimeline`.

Do not define duplicate frontend-only route timeline types.

## Loading And Error Behavior

Follow existing context patterns:

- `rawSnapshot === undefined` means loading.
- Convert only when a snapshot exists.
- Keep error handling simple and consistent with nearby contexts.
- Avoid showing UI in the context; consumers should decide how to present
  loading and error states.

If an error boundary is useful, mirror the pattern in
`ConvexUnifiedTripsContext` or `ConvexRouteTimelineContext`. Do not introduce a
new error-handling style unless necessary.

## Relationship To Route Selection

This stage does not need to redesign route selection. It can accept explicit
`routeAbbrev` and `sailingDay` props.

Future integration can place this provider near the selected route scope. For
now, make the provider composable and easy for route/timeline screens to adopt.

## Non-Goals

Do not:

- refactor `VesselTimeline`
- replace any legacy timeline context usage in this feature
- add timeline selectors beyond small convenience accessors
- build single-trip vertical or horizontal timeline UI
- change backend route timeline schemas or queries unless a real bug is found
- include live `VesselLocation` data in this context
- move route selection state
- add broad caching infrastructure beyond normal React/Convex subscription
  behavior

## Acceptance Criteria

- A new frontend context fetches `RouteTimelineSnapshot` for route and
  `SailingDay`.
- The context uses backend-inferred/domain-converted types from
  `convex/functions/routeTimeline`.
- Optional `vesselAbbrev`, `windowStart`, and `windowEnd` props are passed to
  the backend query correctly.
- The context does not read or expose live `VesselLocation` data.
- `src/data/contexts/index.ts` exports the new provider/hook.
- Existing timeline code remains behaviorally unchanged.
- `bun run type-check` passes.
- `bun run check:fix` passes.

## Verification Commands

Run:

```sh
bun run type-check
bun run check:fix
```

If generated Convex API types are stale, run:

```sh
bun run convex:codegen
bun run type-check
```

If backend types are touched unexpectedly, also run:

```sh
bun run convex:typecheck
```

## Copy-Paste Note

Please implement the next route timeline step: a frontend Convex-backed
`ConvexRouteTimelineContext`. Read
`docs/engineering/2026-04-25-route-timeline-read-model-memo.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-prd.md`,
`docs/engineering/2026-04-25-route-timeline-frontend-context-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Add a
provider/hook under `src/data/contexts/convex` that calls
`api.functions.routeTimeline.queries.getRouteTimelineSnapshot`, passes
`RouteAbbrev`, `SailingDay`, and optional `VesselAbbrev` / `WindowStart` /
`WindowEnd`, converts the result with `toDomainRouteTimelineSnapshot`, and
exports the provider/hook from `src/data/contexts/index.ts`. Keep this stage
limited to frontend data context only; do not refactor `VesselTimeline`, add
selectors, build new timeline UI, or include live `VesselLocation` data. Verify
with `bun run type-check` and `bun run check:fix`; run
`bun run convex:codegen` first if the generated API path is stale.
