# Route Timeline Read Model Memo

**Date:** 2026-04-25  
**Audience:** Engineers planning the next timeline data-model refactor across
Convex and the React Native timeline features.

## Purpose

Summarize the current timeline code state, record the decisions made so far,
and outline the proposed route-scoped timeline read model that should become
the foundation for future timeline UX.

The desired direction is a clean refactor of `VesselTimeline` around a simpler
backend data model. Once that model is in place, day-level vessel timelines,
single-trip vertical timelines, and slim horizontal trip timelines should be
small selector/rendering variations rather than separate data systems.

## Current State

There are several timeline feature folders:

- `src/features/VesselTimeline`
- `src/features/VesselTripTimeline`
- `src/features/TimelineFeatures`

Only `src/features/VesselTimeline` is currently considered strong enough to use
as the production reference point. It provides a graphic-rich vertical timeline
for one vessel over one sailing day.

The older `VesselTripTimeline` and `TimelineFeatures` folders contain useful
experiments and some naming ideas, but they should not drive the next
architecture. They are prototypes, not production contracts.

## Current `VesselTimeline` Architecture

The current production timeline is event-first:

```text
Convex event tables
  -> getVesselTimelineBackbone
  -> ordered boundary events
  -> frontend adjacent intervals
  -> feature-owned rows
  -> renderer rows and row geometry
  -> active indicator placement
```

The backend query is:

- `convex/functions/vesselTimeline/queries.ts`

It returns:

```ts
{
  VesselAbbrev,
  SailingDay,
  events,
}
```

Those `events` are merged from:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

The merge logic lives in:

- `convex/domain/timelineRows/mergeTimelineRows.ts`
- `convex/domain/timelineBackbone/buildTimelineBackbone.ts`

The frontend then rebuilds timeline structure from flat boundary events:

- `src/features/VesselTimeline/renderPipeline/toDerivedRows.ts`
- `convex/shared/timelineIntervals.ts`
- `convex/shared/activeTimelineInterval.ts`

The current render pipeline is explicit and reasonably well tested, but it is
doing more data modeling work on the frontend than we want long term.

## Current Pain Points

The current model starts from atomic boundary events, then asks the frontend to
recover product-level meaning:

- which arrival and departure form a dock stay
- which departure and next arrival form an A to B movement
- which rows should be present for a vessel day
- which active interval maps to which rendered row
- how terminal-card backgrounds should span rows
- how row heights and the active indicator should stay synchronized

The render logic is especially sensitive because row heights are derived from
real durations with a nonlinear compression exponent. The indicator dot and
track fill must remain synced with those derived positions.

Today that synchronization is handled by passing through row-local state such
as row ids, row layouts, row-local position percentages, and separately derived
terminal-card geometry. The current implementation works, but the architecture
forces multiple layers to agree about the same timeline geometry.

## Decisions So Far

### Use `SailingDay`

The primary date scope should remain `SailingDay`, matching the existing system
policy for operational sailing days. The backend should own operational-day
boundaries consistently. Avoid introducing separate calendar-date terminology
for this feature.

### Build A Route-Scoped Snapshot

The desired backend contract is route-scoped:

```ts
getRouteTimelineSnapshot({
  RouteAbbrev,
  SailingDay,
  VesselAbbrev?,
  WindowStart?,
  WindowEnd?,
})
```

The query should always return the same shape, even when narrowed to one vessel
or a time window.

### Cache Route Timeline Data In Context

When a route is selected, the app should fetch/cache the current route's daily
timeline snapshot for all vessels in that route. Timeline pages should then
consume this cached data through selectors rather than issuing one-off queries
when the user moves between pages.

This should improve UX by avoiding the first-second spinner/skeleton when the
data already exists in the selected route context. The payload is expected to be
small enough for this approach; a route may have around one hundred trip
segments or fewer.

### Keep Live Vessel Locations Separate

The timeline snapshot should provide the scaffold:

- scheduled boundaries
- actual overlays
- predicted overlays
- terminal visit order

Live `VesselLocation` data should remain separate and continue to drive active
indicator placement, speed, distance, and live vessel copy. This matches the
current `VesselTimeline` practice.

### Prefer `DockVisit` As The Canonical Primitive

The preferred primitive is not a trip leg and not a stored sea interval. It is
a terminal visit:

```text
A arrival -> A departure
B arrival -> B departure
C arrival -> C departure
```

A crossing is derivable from adjacent visits:

```text
A departure -> B arrival
B departure -> C arrival
```

This avoids duplicating boundary data while preserving flexible composition:

- one-trip timeline: A visit plus B visit
- longer journey: A, B, C visits
- full vessel day: all visits for a vessel
- route timeline: all vessel visit chains for the route

The frontend can derive visual spans from `DockVisit[]` with simple
map/filter/reduce operations.

## Proposed Backend Read Model

The backend should keep the existing write model and event tables. The new
route timeline query should be a read model over those tables.

Conceptual Convex shape:

```ts
RouteTimelineSnapshot
  RouteAbbrev
  SailingDay
  Scope
  Vessels[]

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

The exact field names should follow current Convex schema conventions, including
PascalCase wire fields and domain conversion helpers that map epoch numbers to
`Date` instances.

## Proposed Frontend Model

The frontend should consume the domain-converted route timeline snapshot from
context and expose selectors such as:

- `selectVesselDockVisits(snapshot, vesselAbbrev)`
- `selectTripDockVisits(snapshot, vesselAbbrev, trip identity/window)`
- `selectJourneyDockVisits(snapshot, vesselAbbrev, start, end)`
- `selectVisualSpansFromDockVisits(dockVisits)`

The renderer should ultimately consume a derived axis model:

```text
DockVisit[]
  -> visual spans
  -> axis geometry
  -> renderer rows/cards/indicator
```

The axis geometry layer should be the single source of truth for compressed
duration sizing and absolute position. This should reduce the current need for
separate row-layout and indicator-position logic to stay in sync.

## Proposed Refactor Outline

1. Add backend route timeline schemas and domain conversion helpers.
2. Add a pure backend domain builder that converts merged boundary rows into
   per-vessel `DockVisit[]` chains.
3. Add `getRouteTimelineSnapshot` with route, `SailingDay`, optional vessel,
   and optional time-window args.
4. Add focused backend tests for full route, one-vessel, and windowed scopes.
5. Add a selected route timeline context on the frontend.
6. Add selectors from `RouteTimelineSnapshot` to vessel/trip/journey visit
   slices.
7. Refactor `VesselTimeline` to consume `DockVisit[]` instead of flat events.
8. Extract shared visual-span and axis-geometry logic.
9. Build the new single-trip vertical and horizontal timelines from the same
   selectors and geometry.
10. Retire or quarantine prototype timeline paths once the new model covers the
    intended workflows.

## Open Questions

- What exact existing route selection context should own the snapshot query?
- Should the initial route snapshot fetch all route vessels by default, or
  should some route screens request a narrower first payload?
- How much time-window padding should the backend apply when `WindowStart` and
  `WindowEnd` are passed?
- Should `RouteTimelineSnapshot` include terminal display names, or should the
  frontend continue resolving those through existing terminal context?
- Should the current `getVesselTimelineBackbone` query remain as a compatibility
  path during the transition, or be replaced once the new path is stable?

## Recommended Next Step

Start with the backend. The data contract is the main architectural decision.
Once the route/day dock-visit snapshot is stable and tested, the frontend work
becomes a controlled refactor around selectors and shared geometry rather than
another round of timeline-specific modeling.
