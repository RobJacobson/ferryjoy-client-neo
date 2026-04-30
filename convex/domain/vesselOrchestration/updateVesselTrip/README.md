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
  -> completeTrip? (only when replacement/new trip signal)
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

- `updateVesselTrip.ts`
  - orchestration for one ping and meaningful-change suppression
- `lifecycleSignals.ts`
  - physical lifecycle/new-trip signal helpers
- `completeTrip.ts`
  - completed-row shaping for rollover
- `buildActiveTrip.ts`
  - active row shaping before schedule enrichment
- `scheduleForActiveTrip.ts`
  - schedule-facing field policy for active rows
- `activeTripSchedule/`
  - private schedule resolution helpers (WSF realtime, next-key, schedule tables) used by `scheduleForActiveTrip.ts`
- `tripComparison.ts`
  - durable equality checks
- `tripLifecycle.ts`
  - compatibility helpers used by downstream row-diff consumers only

## Non-ownership

This folder does not own location persistence, prediction computation,
timeline projection, or orchestrator persistence transactions.
