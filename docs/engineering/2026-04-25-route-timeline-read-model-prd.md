# Route Timeline Read Model PRD

**Date:** 2026-04-25  
**Audience:** The next coding agent implementing the route-scoped timeline read
model and the follow-up `VesselTimeline` refactor.

## Purpose

Implement a route/day timeline read model that returns ordered dock visits for
all vessels in a selected route and `SailingDay`, with optional narrowing by
vessel and time window. Use that model to refactor the production
`VesselTimeline` feature and make future single-trip timelines straightforward.

## Product Goal

When a route is selected, the app should have enough route timeline data cached
in context to render timeline-related views immediately:

- route-level views
- one vessel's full-day vertical timeline
- a single A to B trip timeline
- a longer A to B to C journey timeline
- future horizontal compact trip timelines

The user should not see a spinner or skeleton when navigating to a timeline
whose data is already present in the selected route snapshot.

## Scope

In scope:

- backend route timeline schemas
- backend domain builder from existing event tables to dock visits
- public route timeline snapshot query
- domain conversion helpers from Convex epoch values to `Date`
- backend tests for the read model
- selected route timeline frontend context
- frontend selectors over the route timeline snapshot
- `VesselTimeline` refactor to consume dock visits
- shared visual-span and axis-geometry derivation

Out of scope:

- changing the underlying event write model
- embedding live vessel location data into the route timeline snapshot
- redesigning the prediction system
- redesigning route selection globally unless required for snapshot ownership
- productionizing the old prototype timeline folders as-is

## Required Design Decisions

### 1. Use `SailingDay`

All query args, schemas, and docs should use `SailingDay` / `sailingDay`
terminology consistently. This feature should follow the existing operational
sailing-day policy used elsewhere in the app.

### 2. Return One Stable Snapshot Shape

The public query should return the same `RouteTimelineSnapshot` shape for:

- full route/day
- one vessel in the route/day
- route/day with a time window
- one vessel with a time window

Do not introduce separate response shapes such as `VesselTimelineSnapshot`.
Callers can use mapping/filtering selectors.

### 3. Keep Live Location Separate

The route timeline snapshot should contain structural timeline data only.
Continue to use existing live `VesselLocation` data for:

- active indicator position
- speed
- distance
- at-dock / at-sea live state
- moving vessel copy

### 4. Use `DockVisit` As The Primitive

The canonical read model should be ordered dock visits, not stored sea
intervals.

A typical one-trip A to B timeline should be derivable as:

```text
A arrival -> A departure -> B arrival -> B departure, optional
```

A longer A to B to C timeline should be derivable as:

```text
A arrival -> A departure -> B arrival -> B departure -> C arrival
```

Crossing spans are frontend-derived from adjacent dock visits:

```text
visit[i].Departure -> visit[i + 1].Arrival
```

## Stage 1: Backend Schema Contract

Create a route timeline module under `convex/functions/routeTimeline`.

Expected files:

- `convex/functions/routeTimeline/schemas.ts`
- `convex/functions/routeTimeline/queries.ts`
- `convex/functions/routeTimeline/index.ts`

Define validators for:

- route timeline boundary
- route timeline dock visit
- route timeline vessel
- route timeline scope metadata
- route timeline snapshot

Use the current Convex style:

- validators first
- `Infer<typeof schema>` for Convex/wire types
- exported domain conversion helpers
- `Date` conversion through existing shared conversion helpers
- public queries with explicit `args` and `returns`

Acceptance criteria:

- Schemas use Convex validators for every public query return.
- TypeScript types are inferred from schemas rather than manually duplicated in
  frontend code.
- Conversion helpers map all optional epoch millisecond fields to optional
  `Date` fields.
- Field naming is consistent with existing Convex API conventions.

## Stage 2: Backend Domain Builder

Add a pure domain builder that turns existing event-table data into the route
timeline snapshot.

Recommended domain path:

- `convex/domain/routeTimeline/buildRouteTimelineSnapshot.ts`

The builder should:

1. accept route, `SailingDay`, scheduled events, actual events, and predicted
   events
2. reuse or wrap the existing boundary merge behavior from
   `convex/domain/timelineRows/mergeTimelineRows.ts`
3. group merged boundary rows by `VesselAbbrev`
4. pair adjacent arrival/departure boundaries at the same terminal into
   `DockVisit` records
5. preserve start-of-day and end-of-day partial visits when only one boundary is
   available
6. return vessels sorted deterministically
7. return dock visits sorted deterministically within each vessel

Acceptance criteria:

- The builder is pure and testable without Convex context.
- It does not query the database directly.
- It does not duplicate prediction precedence rules already owned by
  `mergeTimelineRows`.
- It handles missing optional arrival/departure boundaries without throwing.
- It preserves the boundary keys and segment keys needed for frontend slicing.

## Stage 3: Public Route Timeline Query

Implement:

```ts
getRouteTimelineSnapshot({
  RouteAbbrev,
  SailingDay,
  VesselAbbrev?,
  WindowStart?,
  WindowEnd?,
})
```

The query should load existing scheduled, actual, and predicted event rows using
indexed access patterns consistent with `docs/convex_rules.mdc`.

Filtering policy:

- `RouteAbbrev` and `SailingDay` are required.
- `VesselAbbrev` narrows the returned vessel list but does not change the
  response shape.
- `WindowStart` and `WindowEnd` narrow the returned visits while preserving
  enough adjacent context to render a complete local timeline.

Important implementation note:

Do not hard-clip raw boundary rows too early. A trip-page request may need the
arrival before the departure or the departure after the arrival to render:

```text
A arrival -> A departure -> B arrival -> B departure
```

Acceptance criteria:

- Full route/day query returns all vessels with dock visits.
- One-vessel query returns the same snapshot shape with one vessel.
- Windowed query includes adjacent context needed for local timeline rendering.
- Query uses explicit validators for args and returns.
- Query does not include live vessel location data.

## Stage 4: Backend Tests

Add focused tests under the route timeline module/domain test folders.

Required cases:

- full route/day with two vessels
- one-vessel filter
- window containing A departure to B arrival includes A arrival and optional B
  departure when available
- start-of-day visit with missing arrival
- terminal-tail visit with missing departure
- actual overlays preserve occurrence semantics
- predicted overlay precedence matches existing timeline backbone behavior
- deterministic ordering for vessels and dock visits

Acceptance criteria:

- Tests cover the pure builder independently of Convex query plumbing.
- Tests make the expected `DockVisit[]` chain clear from fixture names.
- Existing `VesselTimeline` tests continue to pass before frontend migration.

## Stage 5: Frontend Route Timeline Context

Add a selected route timeline context that fetches and caches the route/day
snapshot when a route is selected.

The context should expose:

- route abbrev
- `SailingDay`
- snapshot
- loading state
- error state
- retry/remount behavior if consistent with existing contexts

Acceptance criteria:

- Timeline pages can read route snapshot data without issuing their own
  timeline query in the common selected-route path.
- Deep links or cold starts still have a reasonable loading path.
- Context uses domain-converted types from the Convex schema module.
- No frontend-owned duplicate TypeScript model is introduced.

## Stage 6: Frontend Selectors

Add selectors over `RouteTimelineSnapshot`.

Recommended selectors:

- `selectRouteTimelineVessels(snapshot)`
- `selectVesselDockVisits(snapshot, vesselAbbrev)`
- `selectTripDockVisits(snapshot, args)`
- `selectJourneyDockVisits(snapshot, args)`
- `selectDockVisitVisualSpans(dockVisits)`

The first selector layer should stay domain-oriented. Rendering-specific
geometry should be a later layer.

Acceptance criteria:

- Selectors are pure and unit tested.
- A single A to B trip can be selected as adjacent dock visits.
- A longer journey can be selected as a contiguous dock-visit range.
- The full vessel day is just the full dock-visit list for a vessel.

## Stage 7: Shared Visual Spans And Axis Geometry

Create a shared derivation layer that turns dock visits into renderable spans
and absolute geometry.

Conceptual flow:

```text
DockVisit[]
  -> visual spans
  -> compressed axis geometry
  -> renderer state
```

Visual spans may include:

- dock span: visit arrival to visit departure
- crossing span: current visit departure to next visit arrival
- start placeholder span
- terminal-tail span

The axis geometry layer should own:

- schedule-first duration math for stable sizing
- display-time precedence for active progress
- nonlinear duration compression
- minimum span height
- start-of-day dock caps
- absolute y positions
- content height
- active indicator y position inputs

Acceptance criteria:

- One geometry function is the source of truth for row positions, track fill,
  terminal cards, and indicator placement.
- The active indicator no longer needs separate row-layout synchronization when
  absolute geometry is available.
- Existing `VesselTimeline` visual behavior is preserved or changed only by
  intentional tuning.

## Stage 8: Refactor `VesselTimeline`

Refactor production `VesselTimeline` to consume selected dock visits from the
route timeline snapshot.

Keep the existing visual quality and presentation states. The goal is to
replace the event-first modeling pipeline, not to redesign the visible UI.

Acceptance criteria:

- `VesselTimeline` no longer depends on `getVesselTimelineBackbone` in the
  primary selected-route path.
- Render-state derivation starts from `DockVisit[]`.
- Current tests are migrated or replaced with equivalent dock-visit tests.
- Active indicator still uses live `VesselLocation` data.
- Empty/loading/error states remain clear.

## Stage 9: Add Single-Trip Timeline Variants

After `VesselTimeline` is refactored, add new timelines as small consumers of
the same model:

- vertical single-trip A to B timeline
- slim horizontal A to B timeline

These should render from selected dock visits:

```text
A visit, B visit
```

Acceptance criteria:

- The vertical variant shares visual-span and axis logic with
  `VesselTimeline`.
- The horizontal variant shares domain selectors and time precedence logic.
- Neither variant issues one-off timeline queries in the selected-route path.
- Missing optional B departure is handled cleanly.

## Stage 10: Cleanup Prototype Paths

Once the new model covers the intended workflows, review old prototype folders:

- `src/features/VesselTripTimeline`
- `src/features/TimelineFeatures`

Decide whether to:

- delete unused prototypes
- preserve useful components by moving them behind the new model
- quarantine them with docs noting they are non-production experiments

Acceptance criteria:

- There is one production timeline data model.
- Prototype code does not confuse future implementation work.
- Public feature exports point at production-supported paths only.

## Verification Plan

Backend:

- route timeline builder tests
- route timeline query tests where practical
- `bun run convex:typecheck`

Frontend:

- selector unit tests
- migrated `VesselTimeline` render-pipeline tests
- `bun run type-check`
- `bun run check:fix`

Manual/product verification:

- selected route renders route snapshot once
- switching to one vessel day timeline is immediate when snapshot is warm
- switching to a trip timeline is immediate when snapshot is warm
- active indicator still tracks live vessel location
- missing actual/predicted data degrades gracefully

## Risks

- Window filtering could omit adjacent context if done too early.
- Dock visit grouping could accidentally repair invalid seams that current
  adjacency logic intentionally ignores.
- Refactoring `VesselTimeline` could change visual spacing if the compression
  policy is not preserved carefully.
- Route-level caching could mask stale-data assumptions if context ownership is
  unclear.

## Rollout Recommendation

Do not refactor the frontend until the backend read model is tested. The safest
sequence is:

```text
backend schemas
backend pure builder
backend query
backend tests
frontend context
frontend selectors
VesselTimeline migration
new timeline variants
prototype cleanup
```

This keeps the data-model decision isolated and makes each later stage smaller.
