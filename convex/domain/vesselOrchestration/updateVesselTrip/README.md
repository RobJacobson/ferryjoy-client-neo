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
  -> isNewTrip
  -> buildCompleteTrip? (only when replacement/new trip signal)
  -> buildActiveTrip
  -> applyScheduleForActiveTrip
  -> isSameVesselTrip
```

The orchestrator calls this per vessel inside its ping loop so failures stay
isolated.

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
- `pipeline/` — row shaping and comparison (what the orchestrator steps through before/after schedule)
  - `lifecycleSignals.ts` — physical lifecycle / new-trip signal helpers
  - `buildCompleteTrip.ts` — completed-row shaping for rollover
  - `buildActiveTrip.ts` — active row shaping before schedule enrichment
  - `tripComparison.ts` — durable equality checks
  - `stripTripPredictionsForStorage.ts` — comparison normalization (predictions stripped)
- `schedule/` — schedule-facing policy and resolution
  - `scheduleForActiveTrip.ts` — schedule field policy for active rows
  - `scheduleEnrichment.ts` — merge resolved schedule into a trip row
  - `activeTripSchedule/` — resolution helpers (WSF realtime, next-key, schedule tables)
- `tripLifecycle.ts` — compatibility helpers for downstream row-diff consumers

## Non-ownership

This folder does not own location persistence, prediction computation,
timeline projection, or orchestrator persistence transactions.
