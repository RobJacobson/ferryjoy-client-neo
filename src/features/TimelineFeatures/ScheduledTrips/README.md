## ScheduledTrips — Timeline data flow & matching

This feature renders **scheduled ferry journeys** (WSF schedule) as multi-leg timelines, optionally overlaying **actual / estimated** timing data from our real-time system.

**Quick reference:** Entry point is `ScheduledTripList`; data comes from `useScheduledTripsPageData` → `runScheduledTripsPipeline`. Cards receive `trip` + `vesselTripMap` plus per-journey **display state** (active selection + statuses). The timeline renders directly from segments + vesselTripMap + display state, using PrevKey/NextKey for prev/next trip lookups (flat composition; no pre-joined tuples).

- [Data-flow pipeline](#data-flow-pipeline-schedule-primary)
- [Data sources & loading](#big-picture)
- [File map](#file-map-where-the-logic-lives)
- [Segment model](#the-segment-model-scheduled-legs)
- [Trip overlay](#trip-overlay-preparation-completed--active--held)
- [Active selection](#page-level-active-selection--statuses)
- [Next-trip predictions](#next-trip-predictions-on-future-cards-prevkey-chain)
- [Failure modes](#common-failure-modes-and-why-this-design-prevents-them)
- [Debugging](#implementation-notes--debugging)

The product goal is intentionally simple:

- show each scheduled journey out of a departing terminal (optionally filtered to a destination)
- overlay truth when we have it:
  - actuals for completed/past legs
  - estimates/predictions when available for current and near-future legs
- show at most one “active” indicator per vessel on the page

The key engineering rule is also simple:

- **join everything by the deterministic scheduled trip `Key`**
  - scheduled segments use `segment.Key`
  - trip overlays use `VesselTrip.Key` (when present)

---

## Data-flow pipeline (schedule primary)

Data is processed in two outputs:

1.  **vesselTripMap**
    Inputs: completed trips, active trips, hold-window display data (from `useScheduledTripsMaps`).
    Operation: unified map of segment Key → VesselTrip (completed → active → held precedence).
    Output: `vesselTripMap`. Rendering looks up overlay via `vesselTripMap.get(segment.Key)` and uses `segment.PrevKey`/`segment.NextKey` for prev/next trip lookups.

2.  **Page display state (deterministic selection)**
    Input: journeys, vessel locations, held/active display trips, vesselTripMap.
    Operation: compute per-journey display state (one active per vessel, monotonic segment statuses, inbound-trip prediction wiring).
    Output: `displayStateByJourneyId` (`Map<journeyId, ScheduledTripCardDisplayState>`). Rendering consumes this map plus segments + vesselTripMap.

Schedule is **primary**: the page is **ready** when the schedule is loaded. Overlay (completed/active) is optional; when missing or still loading, the pipeline runs with empty vesselTripMap and the UI shows a **basic schedule** (scheduled times only).

---

## Big picture

### Data sources (and priority)

- **Primary truth for “what is happening now”**
  - `VesselLocation` (WSF real-time feed persisted in Convex)
  - used for:
    - phase: `AtDock` vs at-sea
    - which terminals are being served (`DepartingTerminalAbbrev`, `ArrivingTerminalAbbrev`)
    - authoritative UI time base (`TimeStamp`)
    - real-time distances (`DepartingDistance`, `ArrivingDistance`)
- **Overlay for actuals + ML predictions** (decorator; optional)
  - `activeVesselTrips` + `completedVesselTrips` (+ hold-window display data)
  - used for: actual depart/arrival, prediction outputs. When absent, render basic schedule.

### Key invariant (the join rule)

For each scheduled `Segment`, the corresponding actual/predicted trip is:

- `actualTrip = vesselTripMap.get(segment.Key)`

### Data loading behavior

- **Ready** when the **schedule** is loaded (journeys defined and non-empty). Overlay (maps) may still be loading or null.
- When overlay is null or empty, the pipeline still runs; every segment has no overlay → **basic schedule** render (no actuals, no predictions, no active indicator).
- `useScheduledTripsMaps` may return `null` while completed-trips are loading; the pipeline still runs with empty maps and the list shows cards (schedule-only).

---

## File map (where the logic lives)

- `ScheduledTripList.tsx`
  - calls `useScheduledTripsPageData()` for status, journeys, vesselTripMap, and display state
  - ready when schedule is loaded
  - passes `trip.segments` + `vesselTripMap` + `displayStateByJourneyId.get(trip.id)` + `vesselLocation` to each card
- `useScheduledTripsMaps.ts`
  - builds `PageMaps` from completed trips, active trips, vessel locations, and hold-window display data
  - returns `null` while completed-trips query is loading (when terminals non-empty); pipeline accepts null
- `useScheduledTripsPageData.ts`
  - fetches **raw** scheduled trip rows via `getScheduledTripsForTerminal` (flat array); maps to domain with `toDomainScheduledTrip` immediately (no raw Convex data persisted); reconstructs journeys client-side via `reconstructJourneys(flatDomain, terminalAbbrev, destinationAbbrev)`
  - derives unique departing terminal abbrevs from flat segments (for completed-trip lookups)
  - gets maps from `useScheduledTripsMaps` (may be null)
  - runs `runScheduledTripsPipeline(journeys, maps, terminalAbbrev)` to produce `vesselTripMap` + `displayStateByJourneyId`
  - status **ready** when schedule is loaded (not when maps are ready)
- `utils/scheduledTripsPipeline.ts`
  - **Pipeline**: `computeCardDisplayStateForPage` → `displayStateByJourneyId`; vesselTripMap from maps
  - **Runner**: `runScheduledTripsPipeline(journeys, maps, terminalAbbrev)`; when `maps` is null, uses empty maps → schedule-only render
- `utils/buildPageDataMaps.ts`
  - `buildAllPageMaps()` returns `vesselTripMap`, `vesselLocationByAbbrev`, `displayTripByAbbrev` (completed → active → held precedence); used by `useScheduledTripsMaps` and pipeline
- `utils/reconstructJourneys.ts`
  - client-side journey reconstruction from flat domain segments: group by physical departure, build chains via NextKey, filter by destination; produces `ScheduledTripJourney[]`
- `utils/selectActiveSegmentKey.ts`
  - `selectActiveSegmentKeyForVessel`: selects one active segment key per vessel
  - priority: held (`displayTrip.Key`) → exact (terminals + ScheduledDeparture) → provisional (AtDock, next scheduled segment)
- `utils/computePageDisplayState.ts`
  - page-level display-state computation: groups journeys by vessel internally (Map-based), then per vessel `computeCardDisplayStateForVessel()` which uses `selectActiveSegmentKeyForVessel`
  - returns `Map<journeyId, ScheduledTripCardDisplayState>`
  - Exports types: `ScheduledTripCardDisplayState`, `ScheduledTripTimelineState`, etc.
- `utils/synthesizeTripSegments.ts`
  - Converts raw segments into `TripSegment` view models with monotonic status logic (past/ongoing/future) and phase logic (at-dock/at-sea/completed/pending).
- `types.ts`
  - defines `ScheduledTripJourney` (id, vesselAbbrev, routeAbbrev, departureTime, segments); used by list, display-state computation, and card
  - re-exports `Segment` from Timeline
- `ScheduledTripCard.tsx`
  - Card wrapper: `ScheduledTripRouteHeader` (terminals, vessel name) + `ScheduledTripTimeline`. Receives `trip`, display state, vessel location, and vesselTripMap; no per-card data fetching.
- `ScheduledTripTimeline.tsx`
  - Flat composer: receives `segments` + `vesselTripMap` + per-journey display state and renders Timeline primitives directly. Calls `synthesizeTripSegments` to prepare data for rendering.

---

## The Segment model (scheduled legs)

The backend query `getScheduledTripsForTerminal` returns a **flat** array of scheduled trip rows (numeric timestamps). The client maps to domain with `toDomainScheduledTrip` immediately, then reconstructs journeys (grouping and chain building) in `utils/reconstructJourneys.ts`. No server-side aggregation: the client decides how to consume the raw data.

Important `Segment` fields:

- `Key` (string)
  - deterministic unique ID for this physical (direct) leg
  - primary join key into `vesselTripMap`
- `PrevKey`, `NextKey` (optional)
  - linked-list pointers to previous/next segment in the journey chain
  - used for prev/next trip lookups: `vesselTripMap.get(segment.PrevKey)`, `vesselTripMap.get(segment.NextKey)`
- `DepartingTerminalAbbrev`, `ArrivingTerminalAbbrev`
- `DepartingTime` (Date)
- `SchedArriveCurr`, `SchedArriveNext`, `NextDepartingTime`

Direct vs indirect:

- the schedule backend reconstructs journeys as physical chains by following `NextKey`
- VesselTrips are enriched against direct physical legs
- therefore, `segments[]` rendered here are expected to align with VesselTrip keys

---

## Trip overlay preparation (completed + active + held)

The schedules page gets its unified `Map<string, VesselTrip>` from `useScheduledTripsMaps`, which calls `buildAllPageMaps` (completed → active → held precedence). The map is keyed by `trip.Key`, using `createVesselTripMap` from `../Timeline/utils` as the base:

- completed trips inserted first (via `createVesselTripMap(completedTrips)`)
- active trips overwrite by key
- held `displayData` overwrites by key (UX truth wins during hold)

Trips without a `Key` are not inserted into the map.

### 30s hold window (arrival transition)

The hold behavior lives in `src/features/VesselTrips/useDelayedVesselTrips.ts`:

- when a trip disappears from `activeVesselTrips`, keep it visible for ~30s with an injected `TripEnd`
- freeze `VesselLocation` while holding so UI doesn’t jump to the next run’s location

---

## Page-level active selection + statuses

The schedules page enforces **one active journey per vessel** via `computePageDisplayState.ts`.

### Active key selection priority (per vessel)

1.  **Held identity**: `displayTrip.Key` when present (Exact)
2.  **Exact realtime match** using `VesselLocation.ScheduledDeparture`
    - AtDock: match departing terminal + exact scheduled departure time
    - AtSea: match terminal pair + exact scheduled departure time
3.  **Provisional next selection** (AtDock, missing ScheduledDeparture)
    - known backend latency window for the newly-started trip (key fields not yet present)
    - select the earliest scheduled segment departing this terminal at/after now

### Segment statuses

The `synthesizeTripSegments` utility derives monotonic statuses (past/ongoing/future) for segments within a journey:

- If the journey is **Completed**, all segments are `past`.
- If the journey is **Pending**, all segments are `future`.
- If the journey is **InProgress**, segments before the active segment are `past`, the active segment is `ongoing`, and subsequent segments are `future`.

---

## “Next trip” predictions on future cards (PrevKey chain)

For future segments, a VesselTrip record for `segment.Key` may not exist yet. However, the vessel’s trip for the previous segment (by segment.PrevKey) often has predictions for what happens next:

- `arrive-next` (estimated arrival to the next terminal)
- `depart-next` (estimated next departure)

The timeline derives `predictionTrip` for the first segment (index === 0) as `prevActualTrip`, i.e. `vesselTripMap.get(segment.PrevKey)`—the trip for the inbound leg. The shared timeline utilities surface origin-arrival and depart-next predictions from that trip.

---

## Common failure modes and why this design prevents them

- **Future trip shows Completed**
  - Root cause (historically): a segment accidentally received a completed trip object.
  - Fix: join actual trips only by `segment.Key`, and derive completion from ordering.
- **Multiple “InProgress” segments**
  - Root cause: per-segment inference with conflicting booleans.
  - Fix: display-state computation selects a single `activeKey` and derives monotonic statuses.
- **Phantom indicator on unrelated past/future journey card**
  - Root cause: schedule-time heuristics selecting an “active” leg without evidence.
  - Fix: ScheduledTrips uses a single computation path (`selectActiveSegmentKeyForVessel` + `computeJourneyTimelineState`) with no schedule-time fallback; provisional selection only when AtDock at page terminal.

---

## Implementation notes / debugging

If a journey isn’t showing an indicator when you expect:

- check whether `displayTrip?.Key` exists (hold/identity)
- check whether `VesselLocation.ScheduledDeparture` exists (exact match disambiguation)
- confirm `segments[]` are direct physical legs and that `segment.Key` aligns with VesselTrip keys
