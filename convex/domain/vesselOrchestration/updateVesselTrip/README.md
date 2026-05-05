# updateVesselTrip

`updateVesselTrip` owns one narrow concern:

> Given one vessel location ping, produce the authoritative active and
> completed `ConvexVesselTrip` rows for that vessel update.

## Public surface

Root exports are intentionally small:

- `updateVesselTrip(vesselLocation, existingActiveTrip, dbAccess) -> VesselTripUpdate | null`
- `VesselTripUpdate`
- `UpdateVesselTripDbAccess`

`null` means there is no durable change worth persisting (for example,
timestamp-only churn).

## One-vessel flow

For one vessel, the pipeline is intentionally linear:

```text
updateVesselTrip
  -> startsNewTripLeg
  -> buildCompleteTrip? (only when replacement/new trip signal)
  -> buildActiveTrip
  -> applyScheduleToActiveTrip (schedule merge, then canonical TripKey)
  -> isSameVesselTripData
```

The orchestrator calls this per vessel inside its ping loop so failures stay
isolated.

## TripKey and ScheduleKey

`ScheduleKey` on the active trip row is the schedule segment identity string from
WSF realtime merge or inferred segments (next-key continuity, schedule tables).

`TripKey` uses that same segment string whenever geometry is known: after each
ping, `applyScheduleToActiveTrip` assigns the canonical TripKey. When the ping
carries both `ScheduledDeparture` and `ArrivingTerminalAbbrev`, TripKey is
recomputed from those feed fields (Pacific-local segment formatting via
`buildSegmentKey`), which corrects earlier inference when better data arrives.
When WSF omits those fields but the merged row still has `ScheduleKey`, TripKey
matches `ScheduleKey`. When geometry is still incomplete, TripKey stays on the
provisional row (possibly empty until merge) or carries forward from the prior
active trip until a segment can be formed. Replacement trips without schedule
evidence never carry forward the prior active trip's TripKey.

## Schedule paths

- Complete WSF fields: use `ArrivingTerminalAbbrev` and `ScheduledDeparture`
  from the ping to build the current segment without schedule reads.
- New-trip next-key continuity: when WSF fields are incomplete and the vessel is
  in service, use the prior row's `NextScheduleKey` as resolver input only.
- New-trip schedule-table fallback: when keyed continuity is missing or stale,
  scan current and next service-day schedule rows for the next departure.
- Continuing sparse pings: preserve built/persisted schedule fields and avoid
  schedule reads.
- Unresolved replacement pings: keep the replacement row's provisional identity,
  clear next-leg schedule hints, and do not reuse prior-leg TripKey.

## Contracts this module enforces

- Terminal-abbreviation transition is the authoritative new-trip signal:
  `previous.DepartingTerminalAbbrev !== current.DepartingTerminalAbbrev`.
- Trip-row `AtDock` persists from `AtDockObserved` (stabilized phase), not raw
  feed `AtDock`.
- New/replacement trips may use key-first schedule resolution when WSF fields
  are incomplete and the vessel is in service.
- Continuing trips with incomplete WSF fields carry existing schedule fields and
  must not read schedule every tick.
- Completed+replacement rollover returns both rows in one `VesselTripUpdate`.
- Continuing-trip updates that differ only by `TimeStamp` return `null`.

## Module map

- `updateVesselTrip.ts` — orchestration for one ping and meaningful-change suppression
- `types.ts` — `VesselTripUpdate`, `UpdateVesselTripDbAccess`, schedule read args
- `tripRows/` — active and completed row construction
  - `buildCompleteTrip.ts` — completed-row shaping for rollover
  - `buildActiveTrip.ts` — active row shaping before schedule enrichment
- `comparison/` — storage-data comparison and normalization
  - `isSameVesselTripData.ts` — significant persisted-data equality checks
  - `stripTripPredictionsForStorage.ts` — comparison normalization (predictions stripped)
- `schedule/` — schedule-facing policy and resolution
  - `applyScheduleToActiveTrip.ts` — schedule field policy for active rows
  - `resolveScheduleForActiveTrip.ts` — WSF vs rollover path selection
  - `mergeScheduleResolutionIntoTrip.ts` — merge resolved schedule into a trip row
  - `resolveScheduleFromWsfRealtimeFields.ts` — authoritative WSF realtime path
  - `resolveRolloverScheduleFromContinuity.ts` — next-key and schedule-table inference
- `dockTransitionEvents.ts` — downstream dock-boundary transition facts

## Non-ownership

This folder does not own location persistence, prediction computation,
event projection, or orchestrator persistence transactions.
