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

### Data loading behavior

- `useScheduledTripsMaps` returns `null` when `departingTerminalAbbrevs.length > 0`
  and the completed-trips query is still loading.
- When maps are null, `useScheduledTripsPageData` treats status as `"loading"`, so no
  cards render and the list shows "Loading schedule..." until both schedule and maps are ready.
- When `departingTerminalAbbrevs.length === 0`, maps are built synchronously (no
  completed-trips fetch), so maps are never null in that case.

---

## File map (where the logic lives)

- `ScheduledTripList.tsx`
  - calls `useScheduledTripsPageData()` for status, journeys, card display state, and maps
  - handles loading / empty / ready states and renders a list of `ScheduledTripCard`
  - wraps cards in `ScheduledTripsMapsProvider` so timeline can read maps from context
  - no direct data fetching or map building

- `ScheduledTripsMapsContext.tsx`
  - React context for `PageMaps`; provides maps to cards/timeline via
    `ScheduledTripsMapsProvider` and `useScheduledTripsMapsContext`

- `useScheduledTripsMaps.ts`
  - single place for map construction: takes `sailingDay` and `departingTerminalAbbrevs`
  - uses Convex vessel trips/locations contexts, `useDelayedVesselTrips`, and
    `getCompletedTripsForSailingDayAndTerminals` when terminals are non-empty
  - calls `buildAllPageMaps()`; returns `PageMaps` or `null` while the completed-trips
    query is loading (when `departingTerminalAbbrevs.length > 0`)

- `useScheduledTripsPageData.ts`
  - fetches schedule via `getScheduledTripsForTerminal`, derives `journeys` and
    `departingTerminalAbbrevs`
  - gets maps from `useScheduledTripsMaps({ sailingDay, departingTerminalAbbrevs })`
  - calls `computeCardDisplayStateForPage()` with those maps for one display state per journey card
  - returns `status`, `journeys`, `cardDisplayStateByJourneyId`, `maps`
  - status reflects both schedule and maps loading: treats page as loading when maps are
    null and completed trips are needed

- `utils/buildPageDataMaps.ts`
  - `buildAllPageMaps()` returns `vesselTripMap`, `vesselLocationByAbbrev`, `displayTripByAbbrev`
    in one call (completed → active → held precedence)
  - individual builders (`buildVesselTripMap`, `buildVesselLocationByAbbrev`,
    `buildDisplayTripByAbbrev`) are internal helpers, not exported

- `utils/conversion.ts`
  - `toSegment()`: converts raw Convex scheduled trip rows to frontend `Segment` shape with
    Date timestamps; used when deriving journeys from schedule query

- `utils/segmentUtils.ts`
  - `getDepartingTerminalAbbrevs()`: extracts unique departing terminal abbrevs from segments;
    used by page for completed-trip lookups

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
  - exports types: `ScheduledTripCardDisplayState`, `ScheduledTripTimelineState`, etc.;
    `ScheduledTripJourney` is defined in `types.ts` and re-exported here

- `types.ts`
  - defines `ScheduledTripJourney` (id, vesselAbbrev, routeAbbrev, departureTime, segments);
    used by list, display-state computation, and card
  - re-exports `Segment` from Timeline

- `ScheduledTripCard.tsx`
  - card wrapper that composes `ScheduledTripRouteHeader` (terminals, vessel name)
    and embeds `ScheduledTripTimeline`
  - requires `displayState` from the list; no per-card data fetching

- `ScheduledTripTimeline.tsx`
  - presentational only: requires `displayState` from parent; reads maps via
    `useScheduledTripsMapsContext`
  - single computation path: list uses `computeCardDisplayStateForPage` which uses
    `selectActiveSegmentKeyForVessel` + `computeJourneyTimelineState`
  - uses pre-computed `inboundTripForFirstSegment` from display state for “next-trip”
    predictions (see below)

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

