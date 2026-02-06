## ScheduledTrips — Timeline data flow & matching (current)

This folder renders **scheduled ferry journeys** as a multi-leg timeline while optionally
overlaying **actual / predicted** vessel trip data from the real-time system.

The core design goal is:

- **Exactly one leg can be “active”** (in progress) at a time.
- Everything before the active leg is **Completed**.
- Everything after the active leg is **Pending**.

To achieve this, the current implementation centralizes “what’s active” in a resolver and
uses a **deterministic shared trip key** to match scheduled legs to actual vessel trips.

---

## Big picture

### Data sources (and priority)

- **Primary (truth for “what is happening now”)**
  - `VesselLocation` (WSF real-time feed, persisted in Convex)
  - Used for:
    - `AtDock` vs at-sea phase
    - current terminal pair (Departing/Arriving)
    - distances (`DepartingDistance`, `ArrivingDistance`)
    - authoritative tick time (`TimeStamp`)

- **Secondary (truth for itinerary structure + schedule times)**
  - ScheduledTrips data: ordered `Segment[]` for a journey card
  - Used for:
    - the list/order of legs to render
    - scheduled times: depart / arrivals

- **Secondary (overlay actuals + predictions when available)**
  - `activeVesselTrips` + `completedVesselTrips` from Convex
  - Used for:
    - actual dock depart/arrive times (`LeftDock`, `TripEnd`, etc.)
    - model predictions (`AtDockDepartCurr`, `AtSeaArriveNext`, ...)

### Key invariant

Matching scheduled legs to actual trips is done **by deterministic `Key`**.
This is the most important simplification compared to time/boolean inference.

---

## Relevant files

- `ScheduledTripTimeline.tsx`
  - renders the journey timeline
  - calls the resolver to compute a single active segment and per-leg statuses

- `useScheduledTripDisplayData.ts`
  - fetches real-time vessel state + active/completed trips
  - applies a 30s “hold window” so “Arrived” doesn’t flicker away immediately

- `ScheduledTripList.tsx`
  - renders the page list for a terminal
  - performs **page-level resolution per vessel** so only one journey card per vessel
    can be `InProgress` at a time (journeys before are Completed; after are Pending)
  - passes `journeyStatusOverride` + realtime data down to each card/timeline so cards
    do not refetch per-card and do not independently guess “active”

- `../Timeline/resolveTimeline.ts`
  - chooses `activeKey` and derives monotonic `Completed → InProgress → Pending` statuses

- `../Timeline/TimelineSegmentLeg.tsx`
  - presentation component
  - receives `legStatus`, `activeKey`, `activePhase` and shows bars/indicator accordingly

---

## The Segment model (scheduled legs)

`ScheduledTripCard.tsx` converts the backend journey segments into the shared Timeline
`Segment` shape via `ScheduledTrips/utils/conversion.ts` (`toSegment`).

Important `Segment` fields used for matching/rendering:

- `Key` (string)
  - **Deterministic unique ID for this physical (direct) leg.**
  - This is the primary join key to actual trips.

- `DepartingTerminalAbbrev`, `ArrivingTerminalAbbrev`
- `DepartingTime` (Date)
- `SchedArriveCurr`, `SchedArriveNext`, `NextDepartingTime`

Note on direct vs indirect:

- The scheduled-trips backend reconstructs “journeys” as **physical chains** (direct legs)
  by following `NextKey` pointers.
- VesselTrips enrichment only snapshots direct scheduled trips.
- Therefore, the `segments[]` rendered by `ScheduledTripTimeline` are expected to be
  **direct physical legs**, and `segment.Key` is expected to align with VesselTrip `Key`.

---

## useScheduledTripDisplayData (fetch + hold window)

`useScheduledTripDisplayData.ts`:

1. Reads live `activeVesselTrips` and live `vesselLocations` from Convex contexts.
2. Applies `useDelayedVesselTrips(activeTrips, vesselLocations)`:
   - When a trip disappears from `activeVesselTrips`, it is kept visible for **30 seconds**
     with an injected `TripEnd`.
   - Crucially, it also “freezes” the `vesselLocation` for that held trip so the UI
     doesn’t jump to the next run’s location state.
3. Fetches completed trips for the relevant `sailingDay` + departure terminals via:
   - `api.functions.vesselTrips.queries.getCompletedTripsForSailingDayAndTerminals`
4. Builds a unified `vesselTripMap: Map<string, VesselTrip>`:
   - completed first
   - then active
   - then held/displayData, so held/current wins
5. Returns:
   - `vesselLocation`: the synchronized held location if present, else live location
   - `displayTrip`: the synchronized trip if present (active or held)
   - `vesselTripMap`: for O(1) lookup by `Key`

This hook is what gives the UI a stable “current truth” across the arrival transition.

---

## Matching: scheduled leg ↔ actual trip

### The join rule

For each scheduled `Segment`, the corresponding actual trip is:

- `actualTrip = vesselTripMap.get(segment.Key)`

This is used in `ScheduledTripTimeline.tsx` and passed into `TimelineSegmentLeg` as
`actualTrip` (and `prevActualTrip` / `nextActualTrip` for cross-leg prediction display).

### Why we do not use `DirectKey` here

Indirect scheduled rows can have `DirectKey` linking to the physical leg, but the journey
segments rendered here are already a physical chain. Joining by `segment.Key` ensures:

- a segment never accidentally receives a trip from a different run
- “Completed” cannot leak to future segments due to a mismatched trip attachment

---

## Determining what is active (single source of truth)

`ScheduledTripTimeline.tsx` calls `resolveTimeline()` with:

- the ordered `segments[]`
- the synchronized `vesselLocation`
- `tripsByKey` (`vesselTripMap`)
- `heldTripKey: displayTrip?.Key`
- `nowMs: vesselLocation.TimeStamp.getTime()`
- `allowScheduleFallback: false`

### Active selection priority

`resolveTimeline()` selects the active segment in this order:

1. **Held/active trip key** (from `displayTrip?.Key`) if it exists in `segments[]`.
2. **Real-time terminal + time matching** using `vesselLocation` (fallback):
   - If `AtDock`, match `DepartingTerminalAbbrev`
   - If at sea, match `(DepartingTerminalAbbrev, ArrivingTerminalAbbrev)`
   - Requires `ScheduledDeparture` to disambiguate between multiple sailings with the
     same terminal pair (selects the exact `DepartingTime` match).
3. **Schedule-time fallback**
   - Disabled for ScheduledTrips cards (`allowScheduleFallback: false`).
   - This is an intentional guard against “phantom indicators” on unrelated journeys
     that happen to have time windows overlapping `nowMs`.

### Status derivation (monotonic)

Once an active index is chosen, statuses are derived purely by index:

- `index < activeIndex` → `Completed`
- `index === activeIndex` → `InProgress`
- `index > activeIndex` → `Pending`

If no active segment is selected, no segment is `InProgress`.

---

## TimelineSegmentLeg: phase-aware rendering

`TimelineSegmentLeg.tsx` is responsible for rendering:

- origin arrival marker + optional at-dock bar (first leg only)
- at-sea bar + indicator
- destination arrival marker
- inter-leg at-dock bar (between legs)

It **does not** decide whether a leg is Completed/InProgress/Pending. Instead it receives:

- `legStatus` (monotonic, from resolver)
- `activeKey` (single active segment key)
- `activePhase` (`AtDock` vs `AtSea`)

This combination allows correct behavior like:

- A segment is `InProgress` but only **one phase** shows the indicator:
  - `AtDock` shows dock indicator
  - `AtSea` shows sea indicator
- During the 30s hold (trip has `TripEnd`), the leg is treated as completed while still
  showing an “Arrived” indicator on the active segment.

For label wording (“Arrive” vs “Arrived”), `TimelineSegmentLeg` uses a small derived-state
helper (`getSegmentLegDerivedState`) but those booleans only affect wording and which
times to display (scheduled vs actual vs predicted).

---

## Page-level resolution (why per-card resolution is not enough)

The schedules page displays **many journeys** for the same departing terminal, and a
single vessel can appear multiple times (multiple sailings in one day).

If each card independently tries to infer “active” from terminal matching, it is possible
for multiple cards to appear active (e.g., multiple `BBI → P52` sailings for the same vessel).

To prevent this, `ScheduledTripList.tsx` computes a per-vessel active journey across the
entire page:

- Determine the vessel’s `activeKey` (prefer held `displayTrip.Key`, else `vesselLocation.TripKey`).
- Determine the vessel’s `activeKey` (prefer held `displayTrip.Key`, else derive from
  `VesselLocation` terminals + `ScheduledDeparture` by selecting the closest matching
  scheduled segment Key).
- Find the **one** journey whose `segments[]` contains that `activeKey`.
- Assign journey statuses by chronological order for that vessel:
  - journeys before → `Completed`
  - that journey → `InProgress`
  - journeys after → `Pending`

Only the `InProgress` journey runs segment-level resolution; other cards receive a
`journeyStatusOverride` that forces all legs to Completed/Pending and disables indicators.

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
  - Fix: `allowScheduleFallback: false` for ScheduledTrips cards.

---

## Implementation notes / debugging

If a journey isn’t showing an indicator when you expect:

- Check whether `displayTrip?.Key` exists (new trips can briefly lack a Key until
  `ArrivingTerminalAbbrev` + `ScheduledDeparture` are known upstream).
- Check whether the vessel’s `vesselLocation` terminal pair matches any `segments`.
- Confirm that `segments` are a physical chain (direct legs) and that `segment.Key`
  is the one used by VesselTrips.

