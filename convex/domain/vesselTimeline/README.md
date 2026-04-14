# VesselTimeline Backend Domain

This domain now owns the timeline backbone only.

The backend responsibility is to return one ordered sailing-day event list for a
vessel:

- `eventsScheduled` provides the structural backbone
- `eventsActual` overlays observed arrivals and departures
- `eventsPredicted` overlays display-time predictions

The backend no longer attaches live vessel state to that backbone. In
particular:

- no `vesselLocations` read is part of the public timeline query
- no cross-day carry-in read is part of the public timeline query
- no backend-owned `activeInterval` is part of the wire contract

## Mental Model

Think in three layers:

1. Boundary events are persisted facts.
2. Adjacent intervals are derived structural facts.
3. The client derives the current active interval from those facts and combines
   it with real-time `VesselLocation` for indicator placement.

```text
Persisted tables
  eventsScheduled   eventsActual   eventsPredicted
         |               |                |
         +---------------+----------------+
                         |
                         v
               merge into ordered events
                         |
                         v
               return backbone query payload
                         |
                         v
             client derives active interval
                         |
                         v
      client combines interval + VesselLocation for UI
```

## Public Query Contract

`getVesselTimelineBackbone(VesselAbbrev, SailingDay)` returns:

```ts
{
  VesselAbbrev,
  SailingDay,
  events,
}
```

`events` is the ordered sailing-day event list produced by
`mergeTimelineEvents(...)`.

The query is intentionally same-day only:

- load same-day scheduled events
- load same-day actual overlays
- load same-day predicted overlays
- merge and return

That keeps timeline reads stable and ensures location ticks do not invalidate
the timeline backbone.

### Multiple `eventsPredicted` rows per boundary `Key`

The backbone still exposes **one** `EventPredictedTime` per event `Key`. When
projection stores more than one row for the same `Key` (for example WSF ETA vs
ML on the current arrival boundary), `mergeTimelineEvents` in `timelineEvents.ts`
applies fixed precedence: **prefer `PredictionSource: "wsf_eta"` over ML** when
both exist, then fall back to the ML arrival types in the existing order.

Trip-shaped `vesselTrips` queries are the place to combine **both** streams:
`Eta` (feed / WSF) plus ML-hydrated `AtDockArriveNext` / `AtSeaArriveNext` from
`ml` rows only. UIs that need ML when an official ETA exists should not rely on
the timeline backbone alone for that split.

## Structural Derivation

The shared interval builder still lives in:

- `convex/shared/timelineIntervals.ts`

It derives adjacent structural intervals from ordered events:

- `at-dock`
- `at-sea`

The active-interval resolver now lives in:

- `convex/shared/activeTimelineInterval.ts`

It is a pure helper with actual-only ownership semantics:

- find the latest event in timeline order with `EventActualTime`
- if that event is `dep-dock`, choose the sea interval that starts there
- if that event is `arv-dock`, choose the dock interval that starts there
- if there are no actual events yet, use the opening dock interval
- predicted and scheduled times never advance ownership

This helper is shared logic, not backend-owned state. The client is the primary
consumer for `VesselTimeline`, and other backend code may reuse the same helper
when it needs the same pure derivation.

## Why This Is Simpler

The timeline feature only needs structural truth:

- what boundaries exist today?
- which boundaries have actually completed?
- what predicted times should be displayed?

It does not need backend query-time live attachment. The UI already subscribes
to real-time `VesselLocation`, so indicator placement is a presentational
concern:

- at dock: interpolate progress by time within the active dock interval
- at sea: interpolate progress by distance within the active sea interval

That separation removes the main source of bandwidth churn from the old design.

## Relationship To `vesselTrips`

`vesselTrips` still owns trip lifecycle state. When the live feed omits trip
identity at dock, it may still resolve schedule context from **trip continuity**
(`NextKey` or rollover after a known `ScheduledDeparture`) via targeted
`eventsScheduled` queries — not by re-merging the full backbone on every tick.

That path is not part of the public timeline query. Steady-state docked ticks
should reuse persisted trip identity and avoid redundant schedule reads.

## Core Files

- `events/history.ts`
  During timeline sync, merges WSF vessel history into seeded events: strict
  terminal-based segment keys first; if that misses, an in-memory fallback
  matches `(vessel, scheduled departure)` to `dep-dock` seed rows via
  `createSeededScheduleSegmentResolver` (see `scheduleDepartureLookup.ts`).
- `events/scheduleDepartureLookup.ts`
  Exports `createSeededScheduleSegmentResolver`: builds a per-merge resolver that
  groups `dep-dock` seeds by vessel (`convex/shared/groupBy.ts`) and resolves
  segment keys when history `ScheduledDepart` equals seeded `ScheduledDeparture`.
- `timelineEvents.ts`
  Merges scheduled, actual, and predicted rows into ordered public events.
  Actual overlays attach by optional `ScheduleKey` + `EventType` (aligned segment),
  with bounded arrival fallbacks; persisted `eventsActual` rows use physical
  `EventKey` / `TripKey` (no legacy boundary `Key` column).
- `viewModel.ts`
  Builds the backbone-only query payload.
- `convex/shared/timelineIntervals.ts`
  Shared adjacent-interval derivation.
- `convex/shared/activeTimelineInterval.ts`
  Pure active-interval resolver with actual-only ownership semantics.
- `convex/functions/vesselTimeline/backbone/loadBackboneInputs.ts`
  Loads same-day query inputs only.
- `convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts`
  Composes loads with `viewModel` for the query handler.
- `convex/functions/vesselTimeline/queries.ts`
  Exposes `getVesselTimelineBackbone`.

## Suggested Reading Order

1. this README
2. `timelineEvents.ts`
3. `convex/shared/timelineIntervals.ts`
4. `convex/shared/activeTimelineInterval.ts`
5. `viewModel.ts`
6. `convex/functions/vesselTimeline/backbone/loadBackboneInputs.ts`
7. `convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts`
8. `convex/functions/vesselTimeline/queries.ts`
9. `src/features/VesselTimeline/docs/ARCHITECTURE.md`
