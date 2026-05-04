# Engineering memo: client-owned vessel timeline event queries

**Status:** Proposed refactor  
**Audience:** Engineers, reviewers, and coding agents  
**Scope:** `VesselTimeline` data flow between Convex event tables and the React
Native client

---

## Summary

`VesselTimeline` should move away from the route-scoped snapshot query in
`convex/functions/routeTimeline` and toward direct, vessel-scoped subscriptions
to the three event tables:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

The client should then derive the timeline object it needs from those three
normal row sets. This keeps Convex functions closer to indexed database reads,
keeps client presentation concerns in the client, and lets Convex realtime
subscriptions update only the event slice that changed.

This memo describes the architectural direction. The implementation plan lives
in the companion PRD:
[2026-05-03-vessel-timeline-client-event-queries-prd.md](./2026-05-03-vessel-timeline-client-event-queries-prd.md).

**Update (2026-05-03):** `convex/functions/routeTimeline` and
`convex/domain/routeTimeline` were removed (Stage 5). A follow-up cleanup moved
merge and dock-visit interpretation into `VesselTimeline` client render-pipeline
modules. The route snapshot context path is gone.

---

## Current system (historical — pre–Stage 4/5)

The current data flow has two related server-side read models:

1. `getVesselTimelineBackbone` in `convex/functions/vesselTimeline/queries.ts`
   reads one vessel/day from the three event tables and returns an ordered event
   backbone.
2. `getRouteTimelineSnapshot` in
   `convex/functions/routeTimeline/queries.ts` reads route/day data, discovers
   vessels through `scheduledTrips`, loads the same three event tables for each
   vessel, builds nested dock visits, and returns a route-scoped snapshot.

`VesselTimeline` currently consumes the route-scoped path through
`src/data/contexts/convex/ConvexRouteTimelineContext.tsx`, then adapts the
selected vessel from `RouteTimelineSnapshot` into render rows through
`src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts`.

The backend event tables are already the normalized persistence layer:

- `eventsScheduled` stores the planned dock-boundary backbone.
- `eventsActual` stores observed dock-boundary overlays.
- `eventsPredicted` stores WSF ETA and ML prediction overlays.

All three tables already have `by_vessel_and_sailing_day` indexes in
`convex/schema.ts`, which is the natural query scope for a single vessel
timeline.

Related current docs:

- [VesselTimeline architecture](../../src/features/VesselTimeline/docs/ARCHITECTURE.md)
- [VesselOrchestrator pipeline](../../convex/functions/vesselOrchestrator/VesselOrchestratorPipeline.md)
- [VesselOrchestrator README](../../convex/functions/vesselOrchestrator/README.md)
- [Events functions](../../convex/functions/events)
- [VesselTimeline render pipeline](../../src/features/VesselTimeline/renderPipeline)

---

## Problems motivating the refactor

### Route-level coupling leaks into a vessel feature

`VesselTimeline` renders one vessel, but its active data path asks Convex for a
route/day snapshot. The server discovers route vessels, groups rows by
`VesselAbbrev`, merges those rows into nested dock visits, and returns a shape
that the client immediately selects and adapts back into one vessel's render
model.

That coupling makes the server know too much about a specific client surface.
It also makes the client depend on a route-shaped object when its actual concern
is a vessel/day event stream.

### The route snapshot does too much read-time shaping

`routeTimeline` performs several transformations before the client receives
data:

- discover scheduled trips for the route/day
- group scheduled trips by vessel
- load scheduled, actual, and predicted event rows per vessel
- filter scheduled rows back to route-owned segment keys
- merge event overlays
- pair adjacent boundaries into dock visits
- return nested `Vessels[].DockVisits[]`

Those steps are useful for a route overview, but they are too heavy for the
single-vessel timeline screen.

### Realtime invalidation is broader than necessary

Convex query subscriptions automatically track their database dependencies and
push updated query results to clients when those dependencies change. The
current route snapshot combines several tables and potentially several vessels
into one subscription result.

For `VesselTimeline`, three vessel/day subscriptions are more precise:

- schedule reseeds update the scheduled rows subscription
- observed arrivals/departures update the actual rows subscription
- prediction writes update the predicted rows subscription

That does not remove the need for client-side recomposition, but it narrows the
wire payload and makes each update easier to reason about.

Relevant Convex docs:

- [Convex realtime](https://docs.convex.dev/realtime)
- [Convex sync](https://www.convex.dev/sync)
- [Official Convex rules in this repo](../convex_rules.mdc)
- [Opinionated Convex guide](../opinionated-convex-guide.md)

### Ownership boundaries are clearer with raw event rows

The backend should own durable event facts and indexed query access. The client
should own the presentation model it needs to render the timeline.

This matches the repo's style and architecture guidance:

- Convex functions stay thin and delegate durable business rules to
  `convex/domain`.
- Client-side presentation pipelines live under `src/features`.
- Feature-specific client derivation should be pure and tested near the feature.

See the local style guide:
[.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc).

---

## Desired backend shape

The backend should expose small public queries for normal event rows:

- `listScheduledDockEventsForVesselSailingDay`
- `listActualDockEventsForVesselSailingDay`
- `listPredictedDockEventsForVesselSailingDay`

Each query should:

- accept `VesselAbbrev` and `SailingDay`
- use the existing `by_vessel_and_sailing_day` index
- return validator-only row shapes without Convex metadata unless the client has
  a concrete need for `_id` or `_creationTime`
- avoid route discovery, route filtering, dock-visit pairing, or presentation
  shaping

The existing server-side pure merge logic should not disappear. The policy in
`convex/domain/timelineRows/mergeTimelineRows.ts` captures important semantics
for actual attachment and prediction precedence. The refactor should either
reuse that logic from a client-safe shared module or create an intentionally
mirrored client adapter with parity tests.

`routeTimeline` should become a legacy path during migration and should be
deleted once no production client imports it.

---

## Desired frontend shape

The frontend should introduce a vessel-scoped timeline events context under
`src/data/contexts/convex` or a similarly scoped data boundary. That context
should run three Convex queries:

- scheduled event rows for the active vessel/day
- actual event rows for the active vessel/day
- predicted event rows for the active vessel/day

The `VesselTimeline` feature should then convert those three row sets into the
render model it needs. The preferred shape is:

```text
eventsScheduled query
eventsActual query
eventsPredicted query
  -> client timeline event merge
  -> dock visit / visual span derivation
  -> VesselTimeline render state
```

The client code should keep this distinction clear:

- data contexts subscribe to Convex and expose plain query state
- feature pipeline modules transform event rows into timeline rows and render
  state
- React components render the state and remain thin

The existing `VesselLocation` subscription should remain separate. Location
ticks should continue to affect active indicator placement without forcing the
event backbone to be re-read.

---

## Non-goals

- Do not change how the orchestrator writes `eventsScheduled`,
  `eventsActual`, or `eventsPredicted`.
- Do not collapse the three event tables into one table as part of this
  refactor.
- Do not move route overview behavior into `VesselTimeline`.
- Do not introduce a broad client `src/domain` layer solely for this migration.
  Feature-local pure modules are enough.
- Do not use Convex MCP as a dependency for implementation. It can help inspect
  live data if needed, but this refactor is primarily about static code shape.

---

## Open design decisions

### Shared merge implementation

The safest long-term shape is one pure merge policy consumed by both backend
tests and client rendering. If the current backend module cannot be imported
from `src` without pulling in Convex-only dependencies, create a client-local
mirror first and add parity tests against the backend fixtures.

### Query naming and public API

The existing helper names use `query...` and `load...` internally. Public client
queries should use clear list-style names so they read as table access rather
than presentation read models.

### Route timeline deletion timing

`routeTimeline` should be removed only after all imports from `src` and
`convex/_generated/api.d.ts` references produced by codegen are gone. If another
surface needs route-level dock visits, keep or replace it intentionally rather
than preserving it for `VesselTimeline`.

---

## Document history

- **2026-05-03:** Initial proposal memo for replacing `routeTimeline` in
  `VesselTimeline` with client-owned event table queries.
