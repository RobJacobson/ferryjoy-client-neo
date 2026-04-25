# Route Timeline Stage 2 Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-stage-1-handoff.md](./2026-04-25-route-timeline-stage-1-handoff.md)

## Purpose

Implement Stage 2 of the route timeline read model: a pure backend domain
builder that converts existing merged timeline boundary events into ordered
per-vessel `DockVisit[]` chains.

This stage should not implement the public Convex query, frontend context,
frontend selectors, or `VesselTimeline` refactor. Keep the work pure,
deterministic, and well tested.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)

Review the Stage 1 schema contract:

- [convex/functions/routeTimeline/schemas.ts](../../convex/functions/routeTimeline/schemas.ts)

Review the existing timeline merge/interval logic:

- [convex/domain/timelineRows/mergeTimelineRows.ts](../../convex/domain/timelineRows/mergeTimelineRows.ts)
- [convex/shared/timelineIntervals.ts](../../convex/shared/timelineIntervals.ts)
- [convex/domain/timelineBackbone/buildTimelineBackbone.ts](../../convex/domain/timelineBackbone/buildTimelineBackbone.ts)

## Implementation Scope

Create a new route timeline domain module, likely:

- `convex/domain/routeTimeline/buildRouteTimelineSnapshot.ts`
- `convex/domain/routeTimeline/index.ts`
- `convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts`

The builder should accept already-loaded rows and return the Stage 1
`ConvexRouteTimelineSnapshot` shape.

## Expected Builder Shape

The exact API can vary, but prefer something close to:

```ts
buildRouteTimelineSnapshot({
  RouteAbbrev,
  SailingDay,
  scope,
  scheduledEvents,
  actualEvents,
  predictedEvents,
})
```

where `scope` can represent the future query narrowing args:

```ts
{
  VesselAbbrev?: string;
  WindowStart?: number;
  WindowEnd?: number;
}
```

The builder should return:

```ts
ConvexRouteTimelineSnapshot
```

from `convex/functions/routeTimeline/schemas.ts`.

## Core Behavior

The builder should:

1. reuse or wrap `mergeTimelineRows(...)` for actual/predicted overlays
2. group merged boundary rows by `VesselAbbrev`
3. sort vessels deterministically
4. sort each vessel's boundary rows deterministically using the existing
   timeline ordering semantics
5. pair adjacent compatible boundaries into dock visits:
   - arrival at terminal A followed by departure at terminal A
   - start-of-day departure without a known arrival
   - terminal-tail arrival without a known departure
6. preserve boundary `Key`, `SegmentKey`, `TerminalAbbrev`, `EventType`, and
   time overlay fields exactly as the schema expects
7. populate snapshot `Scope.IsPartial` from the requested scope

The output should model terminal visits:

```text
A arrival -> A departure
B arrival -> B departure
C arrival -> C departure
```

It should not persist or return stored sea intervals. Crossings remain
derivable later from adjacent dock visits:

```text
visit[i].Departure -> visit[i + 1].Arrival
```

## Window Scope Guidance

If `WindowStart` / `WindowEnd` are included in this stage, implement them
carefully and test adjacent context. Do not hard-clip boundary rows so tightly
that a local trip timeline loses needed boundaries.

A future trip-page window containing:

```text
A departure -> B arrival
```

should be able to include enough context for:

```text
A arrival -> A departure -> B arrival -> B departure
```

If window semantics feel too large for this stage, keep the builder structured
so Stage 3 can add window narrowing without rewriting the dock-visit assembly.

## Non-Goals

Do not:

- add `getRouteTimelineSnapshot`
- perform Convex database reads
- register public or internal Convex functions
- alter the Stage 1 schema unless a real contract issue is discovered
- refactor `VesselTimeline`
- add frontend route timeline context
- add frontend selectors
- include live `VesselLocation` in the snapshot
- persist a new table

## Tests To Add

Add focused tests for the pure builder.

Required cases:

- full route/day snapshot with two vessels
- one-vessel scope returns the same snapshot shape with one vessel
- start-of-day visit with missing `Arrival`
- terminal-tail visit with missing `Departure`
- normal dock visit pairs `Arrival` and `Departure` at the same terminal
- invalid terminal seams are not repaired into a dock visit
- actual overlays preserve `EventOccurred` / `EventActualTime` semantics
- predicted overlay precedence matches the existing `mergeTimelineRows`
  behavior
- deterministic ordering for vessels and dock visits

Optional, if window scope is implemented:

- window containing A departure to B arrival keeps A arrival and optional B
  departure context when available

## Acceptance Criteria

- A pure builder returns `ConvexRouteTimelineSnapshot`.
- The builder reuses existing merge semantics instead of duplicating actual and
  prediction overlay rules.
- Dock visits are grouped by vessel and ordered deterministically.
- Optional missing arrival/departure boundaries are represented cleanly.
- Invalid seams are not silently repaired.
- Tests cover the important `DockVisit[]` shapes.
- `bun test convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts`
  passes.
- `bun run convex:typecheck` passes.
- `bun run type-check` passes.

## Verification Commands

Run:

```sh
bun test convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts
bun run convex:typecheck
bun run type-check
```

If formatting/linting changes are needed, run:

```sh
bun run check:fix
```

## Copy-Paste Note

Please implement Stage 2 of the route timeline read model. Read
`docs/engineering/2026-04-25-route-timeline-read-model-memo.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-prd.md`,
`docs/engineering/2026-04-25-route-timeline-stage-2-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Build a
pure backend domain module, likely under `convex/domain/routeTimeline`, that
turns existing scheduled/actual/predicted timeline rows into a
`ConvexRouteTimelineSnapshot` with ordered per-vessel `DockVisits`. Reuse
`mergeTimelineRows(...)` for overlay semantics; do not add the public query,
database reads, frontend context, selectors, or `VesselTimeline` refactor yet.
Add focused builder tests and verify with
`bun test convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts`,
`bun run convex:typecheck`, and `bun run type-check`.
