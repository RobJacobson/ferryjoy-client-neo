# Engineering memo: VesselTimeline current data flow

**Status:** Current architecture (aligned with dock-boundary event modules under `convex/domain/events` and `convex/functions/events/reload`)  
**Audience:** Engineers and coding agents working on `VesselTimeline`  
**Scope:** How event rows are persisted on the backend, how the client fetches them, and how the UI assembles and renders timeline times for one vessel and sailing day

---

## Summary

`VesselTimeline` renders from three vessel/day Convex event-row subscriptions:

- scheduled dock events from `eventsScheduled`
- actual dock events from `eventsActual`
- predicted dock events from `eventsPredicted`

The backend stores **dock-boundary** rows (scheduled / actual / predicted). Naming in domain code uses **dock events** and **`DockBoundaryEventRecord`**-style types; **`VesselTimeline`** remains the **client** feature name for the composed UI.

The backend query layer returns normal table rows. The client owns the interpretation needed by the visual timeline: merging overlays, choosing display times, pairing dock visits, deriving spans, computing axis geometry, and placing the active indicator.

Live vessel position is deliberately separate from the event rows. Event rows define timeline structure and times; `vesselLocations` supplies the current motion/position input for the active indicator.

---

## Backend: how event tables get populated

Two complementary paths feed the same three tables:

### 1. DockReload — sailing-day reload (scheduled + actual slices)

For a full-day refresh, **`runReloadDockEventsForSailingDay`** (`convex/functions/events/reload/reloadDockEventsForSailingDay.ts`):

1. Loads vessel and terminal identity context.
2. Pulls WSF schedule data via **`fetchAndTransformScheduledTrips`** (adapters). Segments are **`RawWsfScheduleSegment`** rows (`convex/adapters/fetch/fetchWsfScheduledTripsTypes.ts`) with **`Date`** departure/arrival instants.
3. **`fetchReloadWsfInputs`** (`convex/functions/events/reload/reloadDockInputs.ts`) loads per-vessel WSF history for the sailing day and maps each raw segment and history row into **`WsfScheduledSegment`** and **`WsfVesselHistory`** (epoch-ms time fields; types in `convex/domain/events/reload/types.ts`).
4. **`buildHydratedDockBoundaryEventsForReload`** (`convex/domain/events/reload/scheduleSeedAndHydration.ts` and related reload domain modules) merges schedule seeds with history actuals into hydrated boundary-event records.
5. **`ctx.runMutation`** to internal **`reseedDockEventsForSailingDay`** (`convex/functions/events/reload/mutations.ts`). That mutation loads trip indexes for the day, **`collect`**s all **`vesselLocations`** rows, runs **`buildReloadDockSliceFromHydratedEvents`**, then persists via **`upsertScheduledRowsForSailingDay`** (`eventsScheduled`) and **`replaceActualRowsForSailingDay`** (`eventsActual`). Reseed **`args`** validators are defined in the same file as the mutation.

**Crons** (`convex/crons.ts`): at the Pacific ~3:00 AM sailing-day boundary, **`reloadDockEventsAtSailingDayBoundary`** runs (with an in-action guard so only the true 3 AM Pacific hour executes), typically with a small multi-day window via **`runReloadDockEventsWindow`**. Public actions for manual/operator use live on **`convex/functions/events/reload/actions.ts`** (e.g. `reloadDockEventsForSailingDay`, `reloadDockEventsForCurrentSailingDay`).

**Operator CLI:** `bun run reload:dock-events` / `scripts/reload-dock-events.ts` invokes those public reload actions over HTTP.

Predicted rows are **not** produced by this daily reload; they come from the live orchestrator path below.

### 2. DockEventLive — orchestrator ping pipeline (sparse actual + predicted)

On each orchestrator cycle, trip updates are merged into **actual** and **predicted** dock event writes (and related patches) through **`updateEvents`** / projection and **`persistVesselUpdates`** (`convex/functions/vesselOrchestrator/`), which upsert into `eventsActual` and reconcile `eventsPredicted` in line with active vessel trips and ML/WSF prediction payloads. Assembly and wire shapes live under **`convex/domain/vesselOrchestration/updateEvents/`**; predicted write batches are built with helpers from **`convex/domain/events/predicted.ts`** and persisted via **`convex/functions/events/eventsPredicted/mutations.ts`**.

So: **DockReload** reshapes full-day scheduled + actual snapshots from schedule + history; **DockEventLive** keeps actual/predicted aligned with live trips between reloads.

---

## Fetch Path

The feature entrypoint is `src/features/VesselTimeline/VesselTimeline.tsx`.

`VesselTimeline` receives:

- `vesselAbbrev`
- `sailingDay`
- optional `now`
- optional visual theme overrides

It mounts `ConvexVesselTimelineEventsProvider` with the vessel/day scope and a retry key. That provider lives at `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx`.

The provider runs three `useQuery` subscriptions:

- `api.functions.events.eventsScheduled.queries.listScheduledDockEventsForVesselSailingDay`
- `api.functions.events.eventsActual.queries.listActualDockEventsForVesselSailingDay`
- `api.functions.events.eventsPredicted.queries.listPredictedDockEventsForVesselSailingDay`

Each query accepts:

```ts
{
  vesselAbbrev: string;
  sailingDay: string;
}
```

The context value is assembled by `src/data/contexts/convex/convexVesselTimelineEventsValue.ts`. It exposes the three row arrays, a combined `isLoading`, an `errorMessage`, and `retry`. Undefined `useQuery` results become empty arrays while `isLoading` remains true.

---

## Convex Queries

The public list queries live under:

- `convex/functions/events/eventsScheduled/queries.ts`
- `convex/functions/events/eventsActual/queries.ts`
- `convex/functions/events/eventsPredicted/queries.ts`

They are grouped under `api.functions.events.*` (see `convex/functions/events/index.ts`). Reload persistence and actions live under **`convex/functions/events/reload/`** and are not used by these read queries.

All three list queries use the `by_vessel_and_sailing_day` index and strip Convex metadata before returning rows.

Scheduled rows are sorted with the same scheduled-boundary ordering helpers used in domain scheduled-event code. Actual rows are sorted by `ScheduledDeparture`, then `EventKey`. Predicted rows are sorted by `ScheduledDeparture`, then `Key`.

The public queries return row shapes matching their table validators. They do not return a prebuilt timeline object.

---

## Presentation Hook

`src/features/VesselTimeline/hooks/useVesselTimelinePresentationState.ts` combines three inputs:

- event rows from `useConvexVesselTimelineEvents`
- current vessel location from `useConvexVesselLocations`
- terminal display names from `useTerminalsData`

It selects the current vessel location by `VesselAbbrev`, creates a terminal name lookup, resolves `now`, and delegates to `buildEventRowTimelinePresentationState`.

`presentationStateBuilders.ts` handles loading, error, empty, and ready states. In the ready path, it calls `fromEventRows`.

---

## Assembly Pipeline

The timeline assembly pipeline starts in `src/features/VesselTimeline/renderPipeline/fromEventRows.ts`.

The main path is:

```text
scheduledEvents + actualEvents + predictedEvents
  -> buildDockVisitsFromEventRows
  -> selectDockVisitVisualSpans
  -> deriveRouteTimelineAxisGeometry
  -> buildVesselTimelineRenderStateFromAxisGeometry
  -> VesselTimelineRenderState
```

`buildDockVisitsFromEventRows.ts` first filters each row array to the requested `vesselAbbrev` and `sailingDay`. It then calls `mergeEventRowsForVesselTimeline`.

`mergeEventRowsForVesselTimeline.ts` creates ordered merged boundary events:

- scheduled rows provide the backbone and ordering
- actual rows attach to scheduled boundaries by `ScheduleKey` and `EventType`
- arrival actuals have bounded fallback matching by terminal and scheduled departure
- predicted rows provide a single display prediction per boundary

Prediction precedence is:

1. WSF ETA
2. ML `AtSeaArriveNext`
3. ML `AtDockArriveNext`
4. first remaining prediction candidate

`buildDockVisitsFromEventRows.ts` converts merged boundary events into client-side `RouteTimelineDockVisit` objects with `Date` timestamps. These types live in `src/features/RouteTimelineModel/types.ts` and intentionally avoid Convex validators or backend read-model shapes.

---

## Time And Indicator Derivation

`RouteTimelineModel` supplies visual geometry helpers:

- `selectDockVisitVisualSpans`
- `deriveRouteTimelineAxisGeometry`
- `getLayoutTime`
- `getDisplayTime`

Layout time uses schedule-first precedence:

```text
scheduled -> actual -> predicted
```

Display/progress time uses:

```text
actual -> predicted -> scheduled
```

`buildVesselTimelineRenderStateFromAxisGeometry.ts` maps axis spans to renderer rows, terminal cards, row layouts, and the active indicator.

The active interval is resolved from occurred boundaries:

- latest occurred departure means the vessel is at sea
- latest occurred arrival means the vessel is at dock
- no occurred boundary means the opening dock row is active when present

The active indicator uses `VesselLocation` only at the final render-state stage:

- at dock: interpolate by time within the active dock row
- at sea: interpolate by `DepartingDistance` and `ArrivingDistance` when available

This keeps location ticks from changing the event-row query shape.

---

## Current Ownership

Convex owns:

- event table storage
- indexed vessel/day list queries
- metadata stripping and deterministic row ordering
- sailing-day dock-event **reload** (schedule + history → `eventsScheduled` / `eventsActual` replacement for that day)
- orchestrator-driven **sparse** writes to `eventsActual` and `eventsPredicted`

`VesselTimeline` owns:

- event-row interpretation
- actual/predicted display precedence for this UI
- dock-visit assembly
- visual spans and render state
- active indicator placement

`RouteTimelineModel` owns generic client geometry helpers and plain client timeline visit types.
