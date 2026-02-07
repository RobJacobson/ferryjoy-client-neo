## ScheduledTrips — Timeline data flow & matching

This feature renders **scheduled ferry journeys** (WSF schedule) as multi-leg timelines,
optionally overlaying **actual / estimated** timing data from our real-time system.

**Quick reference:** Entry point is `ScheduledTripList`; data comes from
`useScheduledTripsPageData` → `runScheduledTripsPipeline`. Cards receive `trip` + **leg props**
(`SegmentLegProps[]` from pipeline); timeline renders from leg props only (no context lookup).

- [Data-flow pipeline](#data-flow-pipeline-schedule-primary)
- [Data sources & loading](#big-picture)
- [File map](#file-map-where-the-logic-lives)
- [Segment model](#the-segment-model-scheduled-legs)
- [Trip overlay](#trip-overlay-preparation-completed--active--held)
- [Active selection](#page-level-active-selection--statuses)
- [Next-trip predictions](#next-trip-predictions-on-future-cards-strict-nextkey-matching)
- [Failure modes](#common-failure-modes-and-why-this-design-prevents-them)
- [Debugging](#implementation-notes--debugging)

The product goal is intentionally simple:

- show each scheduled journey out of a departing terminal (optionally filtered to a
  destination)
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

Data is processed in two pipelines:

1. **Pipeline 1 (reduce/join)**  
   Inputs: all scheduled trips (as journeys with segments), all completed trips, all active trips (plus hold-window display data).  
   Operation: for each **scheduled** segment, attach optional overlay by Key (active wins over completed for same Key).  
   Output: one **SegmentTuple** per segment: `{ segment, actualTrip?, journeyId, vesselAbbrev, segmentIndex }`.

2. **Pipeline 2 (map)**  
   Input: segment tuples plus vessel locations and terminal.  
   Operation: compute card display state (one active per vessel) and per-segment leg props (status, leg derived state).  
   Output: `legPropsByJourneyId` (and internally card display state for building leg props). The list passes
   `legPropsByJourneyId.get(trip.id)` to each card; the timeline renders from these
   **leg props** only (no context or Key lookup at render).

Schedule is **primary**: the page is **ready** when the schedule is loaded. Overlay (completed/active) is optional; when missing or still loading, the pipeline runs with empty overlay and the UI shows a **basic schedule** (scheduled times only).

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
  - calls `useScheduledTripsPageData()` for status, journeys, and leg props
  - ready when schedule is loaded
  - passes `legPropsByJourneyId.get(trip.id)` to each card so timeline can render from pipeline output

- `useScheduledTripsMaps.ts`
  - builds `PageMaps` from completed trips, active trips, vessel locations, and hold-window display data
  - returns `null` while completed-trips query is loading (when terminals non-empty); pipeline accepts null

- `useScheduledTripsPageData.ts`
  - fetches **raw** scheduled trip rows via `getScheduledTripsForTerminal` (flat array); maps to
    domain with `toDomainScheduledTrip` immediately (no raw Convex data persisted); reconstructs
    journeys client-side via `reconstructJourneys(flatDomain, terminalAbbrev, destinationAbbrev)`
  - derives unique departing terminal abbrevs from flat segments (for completed-trip lookups)
  - gets maps from `useScheduledTripsMaps` (may be null)
  - runs `runScheduledTripsPipeline(journeys, maps, terminalAbbrev)` to produce
    `legPropsByJourneyId` (and internally display state for building leg props)
  - status **ready** when schedule is loaded (not when maps are ready)

- `utils/scheduledTripsPipeline.ts`
  - **Pipeline 1**: `buildSegmentTuples(journeys, vesselTripMap)` → one `SegmentTuple` per segment (join by Key)
  - **Pipeline 2**: card display state via `computeCardDisplayStateForPage`; then map tuples to leg props (status, legState) per journey
  - **Runner**: `runScheduledTripsPipeline(journeys, maps, terminalAbbrev)`; when `maps` is null, uses empty vesselTripMap → schedule-only render

- `utils/buildPageDataMaps.ts`
  - `buildAllPageMaps()` returns `vesselTripMap`, `vesselLocationByAbbrev`, `displayTripByAbbrev`
    (completed → active → held precedence); used by `useScheduledTripsMaps` and pipeline

- `utils/reconstructJourneys.ts`
  - client-side journey reconstruction from flat domain segments: group by physical departure,
    build chains via NextKey, filter by destination; produces `ScheduledTripJourney[]`

- `utils/selectActiveSegmentKey.ts`
  - `selectActiveSegmentKeyForVessel`: selects one active segment key per vessel
  - priority: held (`displayTrip.Key`) → exact (terminals + ScheduledDeparture) →
    provisional (AtDock, next scheduled segment)

- `utils/computePageDisplayState.ts`
  - page-level display-state computation: `groupJourneysByVessel()` (reduce-based), then per vessel
    `computeCardDisplayStateForVessel()` which uses `selectActiveSegmentKeyForVessel` and
    `computeJourneyTimelineState`
  - computes `inboundTripForFirstSegment` for next-trip predictions (strict `NextKey` matching)
  - returns `Map<journeyId, ScheduledTripCardDisplayState>`
  - Exports types: `ScheduledTripCardDisplayState`, `ScheduledTripTimelineState`, etc.
    `ScheduledTripJourney` is defined in `types.ts`; this module re-exports it.

- `types.ts`
  - defines `ScheduledTripJourney` (id, vesselAbbrev, routeAbbrev, departureTime, segments);
    used by list, display-state computation, and card
  - re-exports `Segment` from Timeline

- `ScheduledTripCard.tsx`
  - Card wrapper: `ScheduledTripRouteHeader` (terminals, vessel name) +
    `ScheduledTripTimeline`. Receives `trip` and `legProps` from the list; no
    per-card data fetching.

- `ScheduledTripTimeline.tsx`
  - Presentational: receives `segments` and `legProps` from the card. Renders one
    `ScheduledTripLeg` per segment; no context lookup—all data comes from leg props.
- `ScheduledTripLeg.tsx`
  - Renders one leg (origin arrive → at-dock → depart → at-sea → arrive) using
    Timeline primitives: `TimelineMarker`, `TimelineBarAtDock`, `TimelineBarAtSea`,
    `TimelineDisplayTime`. Receives `SegmentLegProps` from pipeline (or computes
    `legState` when not pre-computed). Uses `legStatus`, `activeKey`, `activePhase`,
    and joined trips (`actualTrip`, `prevActualTrip`, `nextActualTrip`, `predictionTrip`).

---

## The Segment model (scheduled legs)

The backend query `getScheduledTripsForTerminal` returns a **flat** array of scheduled trip rows
(numeric timestamps). The client maps to domain with `toDomainScheduledTrip` immediately, then
reconstructs journeys (grouping and chain building) in `utils/reconstructJourneys.ts`. No
server-side aggregation: the client decides how to consume the raw data.

Important `Segment` fields:

- `Key` (string)
  - deterministic unique ID for this physical (direct) leg
  - primary join key into `vesselTripMap`
- `DepartingTerminalAbbrev`, `ArrivingTerminalAbbrev`
- `DepartingTime` (Date)
- `SchedArriveCurr`, `SchedArriveNext`, `NextDepartingTime`

Direct vs indirect:

- the schedule backend reconstructs journeys as physical chains by following `NextKey`
- VesselTrips are enriched against direct physical legs
- therefore, `segments[]` rendered here are expected to align with VesselTrip keys

---

## Trip overlay preparation (completed + active + held)

The schedules page gets its unified `Map<string, VesselTrip>` from `useScheduledTripsMaps`,
which calls `buildAllPageMaps` (completed → active → held precedence). The map is keyed by
`trip.Key`, using `createVesselTripMap` from `../Timeline/utils` as the base:

- completed trips inserted first (via `createVesselTripMap(completedTrips)`)
- active trips overwrite by key
- held `displayData` overwrites by key (UX truth wins during hold)

Trips without a `Key` are not inserted into the map.

### 30s hold window (arrival transition)

The hold behavior lives in `src/features/VesselTrips/useDelayedVesselTrips.ts`:

- when a trip disappears from `activeVesselTrips`, keep it visible for ~30s with an
  injected `TripEnd`
- freeze `VesselLocation` while holding so UI doesn’t jump to the next run’s location

---

## Page-level active selection + statuses

The schedules page enforces **one active journey per vessel** via
`computePageDisplayState.ts`.

### Active key selection priority (per vessel)

1. **Held identity**: `displayTrip.Key` when present (Exact)
2. **Exact realtime match** using `VesselLocation.ScheduledDeparture`
   - AtDock: match departing terminal + exact scheduled departure time
   - AtSea: match terminal pair + exact scheduled departure time
3. **Provisional next selection** (AtDock, missing ScheduledDeparture)
   - known backend latency window for the newly-started trip (key fields not yet present)
   - select the earliest scheduled segment departing this terminal at/after now
   - mark confidence as `Provisional`

### Segment statuses

If the journey is the vessel’s active journey:

- statuses are monotonic by index: Completed → InProgress → Pending

If we cannot safely identify an active segment for the journey:

- we do not show a “phantom InProgress” segment
- we still render Completed vs Pending for the whole journey using:
  - schedule bounds (journey ended before now), and
  - authoritative `VesselTrip.TripEnd` when a matching trip exists for a segment key

---

## “Next trip” predictions on future cards (strict `NextKey` matching)

For future segments, a VesselTrip record for `segment.Key` may not exist yet.
However, the vessel’s current inbound trip often has predictions for what happens next:

- `arrive-next` (estimated arrival to the next terminal)
- `depart-next` (estimated next departure)

These predictions are computed in `computePageDisplayState.ts`
(`getInboundTripForFirstSegment`) using the scheduled chain pointer:

- `displayTrip.ScheduledTrip.NextKey === firstSegment.Key`

When that matches, the inbound trip is stored as `inboundTripForFirstSegment` in display
state and passed down as `prevActualTrip` so the shared timeline utilities can surface
origin-arrival and depart-next predictions for that future segment.

This is strict key matching (not time-window inference) to prevent prediction leakage onto
unrelated future cards.

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
  - Fix: ScheduledTrips uses a single computation path
    (`selectActiveSegmentKeyForVessel` + `computeJourneyTimelineState`) with no schedule-time
    fallback; provisional selection only when AtDock at page terminal.

---

## Implementation notes / debugging

If a journey isn’t showing an indicator when you expect:

- check whether `displayTrip?.Key` exists (hold/identity)
- check whether `VesselLocation.ScheduledDeparture` exists (exact match disambiguation)
- confirm `segments[]` are direct physical legs and that `segment.Key` aligns with VesselTrip keys

