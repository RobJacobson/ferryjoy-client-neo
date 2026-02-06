## ScheduledTrips — Timeline data flow & matching (current)

This feature renders **scheduled ferry journeys** (WSF schedule) as multi-leg timelines,
optionally overlaying **actual / estimated** timing data from our real-time system.

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

## Big picture

### Data sources (and priority)

- **Primary truth for “what is happening now”**
  - `VesselLocation` (WSF real-time feed persisted in Convex)
  - used for:
    - phase: `AtDock` vs at-sea
    - which terminals are being served (`DepartingTerminalAbbrev`, `ArrivingTerminalAbbrev`)
    - authoritative UI time base (`TimeStamp`)
    - real-time distances (`DepartingDistance`, `ArrivingDistance`)

- **Primary truth for itinerary structure + scheduled times**
  - `ScheduledTrips` (WSF schedule, reconstructed into journeys)
  - used for:
    - which segments exist and their chronological order
    - scheduled depart/arrive timestamps

- **Secondary overlay for actuals + ML predictions**
  - `activeVesselTrips` + `completedVesselTrips`
  - used for:
    - actual depart/arrival (`LeftDock`, `TripEnd`, etc.)
    - prediction outputs (`AtDockDepartCurr`, `AtSeaArriveNext`, `AtDockDepartNext`, ...)

### Key invariant (the join rule)

For each scheduled `Segment`, the corresponding actual/predicted trip is:

- `actualTrip = vesselTripMap.get(segment.Key)`

---

## File map (where the logic lives)

- `ScheduledTripList.tsx`
  - calls `useScheduledTripsPageData()` for status, journeys, and page resolution
  - handles loading / empty / ready states and renders a list of `ScheduledTripCard`
  - no direct data fetching or map building

- `useScheduledTripsPageData.ts`
  - fetches schedule journeys, completed/active trips, and real-time contexts
  - builds all three maps in one call via `buildAllPageMaps()` in `utils/buildPageDataMaps`
  - calls `resolveScheduledTripsPageResolution()` for one resolution per journey card
  - returns `status`, `journeys`, `pageResolutionByTripId`

- `utils/buildPageDataMaps.ts`
  - `buildAllPageMaps()` returns `vesselTripMap`, `vesselLocationByAbbrev`, `displayTripByAbbrev`
    in one call (completed → active → held precedence)
  - individual helpers still available: `buildVesselTripMap`, `buildVesselLocationByAbbrev`,
    `buildDisplayTripByAbbrev`

- `utils/selectActiveSegmentKey.ts`
  - `selectActiveSegmentKeyForVessel`: selects one active segment key per vessel
  - priority: held (`displayTrip.Key`) → exact (terminals + ScheduledDeparture) →
    provisional (AtDock, next scheduled segment)

- `utils/resolveScheduledTripsPageResolution.ts`
  - page-level resolver: `groupJourneysByVessel()` (Object.groupBy), then per vessel
    `resolveResolutionsForVessel()` which uses `selectActiveSegmentKeyForVessel` and
    `resolveJourneyTimeline`
  - returns `Map<journeyId, ScheduledTripCardResolution>`
  - exports `resolveSingleJourneyTimeline` for standalone timeline (same resolution path)
  - exports types: `ScheduledTripCardResolution`, `ScheduledTripTimelineResolution`, etc.;
    `ScheduledTripJourney` is defined in `types.ts` and re-exported here

- `types.ts`
  - defines `ScheduledTripJourney` (id, vesselAbbrev, routeAbbrev, departureTime, segments);
    used by list, resolver, and card
  - re-exports `Segment` from Timeline

- `ScheduledTripCard.tsx`
  - card wrapper that composes `ScheduledTripRouteHeader` (terminals, vessel name)
    and embeds `ScheduledTripTimeline`
  - passes single `resolution` prop when present; timeline does not call
    `useScheduledTripDisplayData` when resolution is provided

- `ScheduledTripTimeline.tsx`
  - when `resolution` is provided: renders presentational content only (no hook)
  - when `resolution` is missing: renders `ScheduledTripTimelineWithData`, which
    calls `useScheduledTripDisplayData` and `resolveSingleJourneyTimeline`
  - single resolution path: list and standalone both use
    `selectActiveSegmentKeyForVessel` + `resolveJourneyTimeline` / `resolveSingleJourneyTimeline`
  - attaches “next-trip” predictions by strict `NextKey` matching (see below)

- `useScheduledTripDisplayData.ts`
  - per-vessel fetch hook used only when a timeline is rendered **without** resolution
    (e.g. standalone use of `ScheduledTripTimeline`); list cards do not call it
  - builds `vesselTripMap` via `buildPageDataMaps`; includes 30s hold via
    `useDelayedVesselTrips()`

- `../Timeline/TimelineSegmentLeg.tsx`
  - UI component that renders a segment leg given:
    - `legStatus` (Completed/InProgress/Pending)
    - `activeKey` + `activePhase`
    - joined trips (`actualTrip`, `prevActualTrip`, `nextActualTrip`)

---

## The Segment model (scheduled legs)

The schedules backend returns journeys as arrays of Convex scheduled trip rows.
On the client we convert them into the shared timeline `Segment` shape via
`ScheduledTrips/utils/conversion.ts` (`toSegment`).

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

The schedules page builds a unified `Map<string, VesselTrip>` in `useScheduledTripsPageData`;
when a timeline is used without resolution (standalone), `useScheduledTripDisplayData` builds
it. In both cases the map is keyed by `trip.Key`, using `createVesselTripMap` from
`../Timeline/utils` as the base:

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
`resolveScheduledTripsPageResolution.ts`.

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

These predictions are attached deterministically in `ScheduledTripTimeline.tsx` using the
scheduled chain pointer:

- `displayTrip.ScheduledTrip.NextKey === firstSegment.Key`

When that matches, `displayTrip` is passed down as `prevActualTrip` so the shared timeline
utilities can surface origin-arrival and depart-next predictions for that future segment.

This is strict key matching (not time-window inference) to prevent prediction leakage onto
unrelated future cards.

---

## Common failure modes and why this design prevents them

- **Future trip shows Completed**
  - Root cause (historically): a segment accidentally received a completed trip object.
  - Fix: join actual trips only by `segment.Key`, and derive completion from ordering.

- **Multiple “InProgress” segments**
  - Root cause: per-segment inference with conflicting booleans.
  - Fix: resolver selects a single `activeKey` and derives monotonic statuses.

- **Phantom indicator on unrelated past/future journey card**
  - Root cause: schedule-time heuristics selecting an “active” leg without evidence.
  - Fix: ScheduledTrips uses a single resolution path
    (`selectActiveSegmentKeyForVessel` + `resolveJourneyTimeline` / `resolveSingleJourneyTimeline`)
    with no schedule-time fallback; provisional selection only when AtDock at page terminal.

---

## Implementation notes / debugging

If a journey isn’t showing an indicator when you expect:

- check whether `displayTrip?.Key` exists (hold/identity)
- check whether `VesselLocation.ScheduledDeparture` exists (exact match disambiguation)
- confirm `segments[]` are direct physical legs and that `segment.Key` aligns with VesselTrip keys

