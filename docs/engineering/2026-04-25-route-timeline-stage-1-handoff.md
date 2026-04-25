# Route Timeline Stage 1 Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)

## Purpose

Implement Stage 1 of the route timeline read model: the backend Convex schema
contract and domain conversion helpers for `RouteTimelineSnapshot`.

This stage should not implement the query, database loading, frontend context,
or `VesselTimeline` refactor. Keep the work intentionally small so the data
contract can be reviewed before behavior is built on top of it.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)

Follow the current Convex schema/conversion style used in:

- [convex/functions/vesselTimeline/schemas.ts](../../convex/functions/vesselTimeline/schemas.ts)
- [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)

## Implementation Scope

Create the initial backend module:

- `convex/functions/routeTimeline/schemas.ts`
- `convex/functions/routeTimeline/index.ts`

Optionally create `convex/functions/routeTimeline/queries.ts` only if needed as
a placeholder entry point, but do not add a real public query in this stage
unless explicitly requested.

## Schema Requirements

Define Convex validators for:

- route timeline boundary
- route timeline dock visit
- route timeline vessel
- route timeline scope metadata
- route timeline snapshot

The snapshot should support a stable future query shape like:

```ts
getRouteTimelineSnapshot({
  RouteAbbrev,
  SailingDay,
  VesselAbbrev?,
  WindowStart?,
  WindowEnd?,
})
```

The return shape should remain stable whether the future query returns a full
route/day, one vessel, or a windowed subset.

## Naming Requirements

Use existing Convex API naming conventions:

- PascalCase fields in Convex/wire objects
- `SailingDay`, not calendar-date terminology
- `RouteAbbrev`
- `VesselAbbrev`
- `DockVisits`
- `Arrival`
- `Departure`

Do not introduce separate frontend-only TypeScript models. Types should be
inferred from Convex validators and then domain-converted.

## Suggested Shape

The exact implementation can vary, but the schema should cover this conceptual
model:

```ts
RouteTimelineSnapshot
  RouteAbbrev
  SailingDay
  Scope
  Vessels[]

RouteTimelineScope
  VesselAbbrev?
  WindowStart?
  WindowEnd?
  IsPartial

RouteTimelineVessel
  VesselAbbrev
  DockVisits[]

RouteTimelineDockVisit
  Key
  VesselAbbrev
  SailingDay
  TerminalAbbrev
  Arrival?
  Departure?

RouteTimelineBoundary
  Key
  SegmentKey
  TerminalAbbrev
  EventType
  EventScheduledTime?
  EventPredictedTime?
  EventOccurred?
  EventActualTime?
```

Use the existing dock event type validator from scheduled event schemas rather
than hand-rolling event-type string unions.

## Conversion Helpers

Add domain conversion helpers in `schemas.ts`, following the existing pattern:

- export Convex/wire types via `Infer<typeof schema>`
- export `toDomainRouteTimelineSnapshot`
- convert epoch millisecond fields to `Date`
- convert optional epoch fields with `optionalEpochMsToDate`
- keep non-time fields unchanged

Useful existing helpers:

- `epochMsToDate`
- `optionalEpochMsToDate`

## Non-Goals

Do not:

- load database rows
- add `getRouteTimelineSnapshot`
- group events into dock visits
- refactor `VesselTimeline`
- add frontend context/selectors
- include live `VesselLocation` in the snapshot
- persist a new table

Stage 1 is only the schema and conversion contract.

## Acceptance Criteria

- `convex/functions/routeTimeline/schemas.ts` exports validators, inferred
  types, and domain conversion helpers.
- `convex/functions/routeTimeline/index.ts` exposes the module's intended
  public API.
- All timestamp conversion behavior mirrors existing Convex schema modules.
- The contract can represent full-route, one-vessel, and windowed snapshots
  without changing response shape.
- The contract represents optional missing arrival/departure boundaries.
- `bun run convex:typecheck` passes.
- `bun run type-check` passes.

## Verification Commands

Run:

```sh
bun run convex:typecheck
bun run type-check
```

If formatting/linting changes are needed, run:

```sh
bun run check:fix
```

## Copy-Paste Note

Please implement Stage 1 of the route timeline read model. Read
`docs/engineering/2026-04-25-route-timeline-read-model-memo.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-prd.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Add the
initial `convex/functions/routeTimeline` schema module for
`RouteTimelineSnapshot`, including Convex validators, inferred TS types, and
domain conversion helpers from epoch milliseconds to `Date`. Keep this stage
limited to schema/conversion/index exports only; do not implement the query,
database loading, frontend context, or `VesselTimeline` refactor yet. Verify
with `bun run convex:typecheck` and `bun run type-check`.
