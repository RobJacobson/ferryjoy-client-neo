# Route Timeline Selectors Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-frontend-context-handoff.md](./2026-04-25-route-timeline-frontend-context-handoff.md)

## Purpose

Implement the next route timeline frontend layer: pure domain selectors over
`RouteTimelineSnapshot`.

The backend read model and frontend context now exist. This stage should make
it easy for future timeline components to select route, vessel, trip, and
journey slices from the cached snapshot.

Keep this stage domain-only. Do not implement visual spans, axis geometry,
timeline rendering, or a `VesselTimeline` refactor yet.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)

Review implemented contracts:

- [convex/functions/routeTimeline/schemas.ts](../../convex/functions/routeTimeline/schemas.ts)
- [src/data/contexts/convex/ConvexRouteTimelineContext.tsx](../../src/data/contexts/convex/ConvexRouteTimelineContext.tsx)

## Implementation Scope

Create a small frontend domain module for route timeline selection.

Recommended path:

- `src/features/RouteTimelineModel/selectors.ts`
- `src/features/RouteTimelineModel/index.ts`
- `src/features/RouteTimelineModel/tests/selectors.test.ts`

If a different location better fits the repo after inspection, keep the module
name and ownership clear. Avoid placing selectors inside UI-specific timeline
feature folders.

## Selector Goals

Add pure selectors over the domain-converted `RouteTimelineSnapshot` type from
`convex/functions/routeTimeline`.

Recommended selectors:

```ts
selectRouteTimelineVessels(snapshot)
selectVesselDockVisits(snapshot, vesselAbbrev)
selectTripDockVisits(snapshot, args)
selectJourneyDockVisits(snapshot, args)
```

The exact function signatures can vary, but they should support:

- full route vessel list
- one vessel's full-day dock visits
- one A to B trip slice as adjacent dock visits
- one longer contiguous journey slice

## Suggested Matching Inputs

For trip and journey selectors, prefer stable boundary/visit identities over
fragile display labels.

Useful inputs may include:

- `vesselAbbrev`
- `departureBoundaryKey`
- `arrivalBoundaryKey`
- `startVisitKey`
- `endVisitKey`
- `fromTerminalAbbrev`
- `toTerminalAbbrev`

Keep APIs simple and explicit. If there is uncertainty, implement the safest
small selectors first:

- by vessel
- by visit key range
- by departure boundary key plus next visit

Avoid adding broad fuzzy matching that could select the wrong trip when a route
visits the same terminal multiple times.

## Domain Rules

The selectors should treat `DockVisit[]` as the source of truth:

```text
A visit, B visit
```

represents a single A to B trip because the crossing is derivable from:

```text
A.Departure -> B.Arrival
```

For this stage, do not create visual span types such as dock/crossing rows.
That belongs in the following geometry stage.

## Non-Goals

Do not:

- call Convex queries
- add React context
- use live `VesselLocation` data
- create visual spans
- compute pixel geometry
- implement active indicator placement
- refactor `VesselTimeline`
- build single-trip vertical or horizontal timeline UI
- duplicate backend route timeline types in frontend-only models

## Tests To Add

Add focused selector tests.

Required cases:

- `null` snapshot returns empty arrays
- route vessels preserve snapshot order
- vessel dock visits return the requested vessel's visits
- missing vessel returns an empty array
- single-trip selector returns adjacent A and B visits for a departure/arrival
  pair
- journey selector returns a contiguous visit range
- duplicate terminal visits do not cause ambiguous terminal-only selection
  unless the selector signature explicitly disambiguates

## Acceptance Criteria

- Selectors are pure and have no React or Convex runtime dependency.
- Selectors import domain-converted types from `convex/functions/routeTimeline`.
- The module has a narrow public `index.ts`.
- Tests cover full-day, single-trip, and journey slicing.
- No visual rendering logic is added.
- `bun test src/features/RouteTimelineModel/tests/selectors.test.ts` passes.
- `bun run type-check` passes.
- `bun run check:fix` passes.

## Verification Commands

Run:

```sh
bun test src/features/RouteTimelineModel/tests/selectors.test.ts
bun run type-check
bun run check:fix
```

If the module is placed elsewhere, adjust the focused test path accordingly.

## Copy-Paste Note

Please implement the next route timeline stage: pure frontend selectors over
`RouteTimelineSnapshot`. Read
`docs/engineering/2026-04-25-route-timeline-read-model-memo.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-prd.md`,
`docs/engineering/2026-04-25-route-timeline-selectors-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Add a small
domain module, preferably `src/features/RouteTimelineModel`, with selectors
that can return route vessels, one vessel's dock visits, a single A -> B trip
slice, and a contiguous journey slice from the cached route timeline snapshot.
Keep this stage domain-only: no Convex calls, React context, live
`VesselLocation`, visual spans, pixel geometry, active indicator logic,
`VesselTimeline` refactor, or new timeline UI. Add focused selector tests and
verify with `bun test src/features/RouteTimelineModel/tests/selectors.test.ts`,
`bun run type-check`, and `bun run check:fix`.
