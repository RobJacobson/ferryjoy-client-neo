# updateVesselTrips (orchestrator concern)

**Trip branch** logic (invoked from [`updateVesselOrchestrator`](../../../functions/vesselOrchestrator/actions.ts) via the local **`updateVesselTrips`** step — `computeVesselTripsWithClock` → `persistVesselTripWriteSet`): the full
**lifecycle** implementation used on each cron tick.

## Layout

| Path | Role |
| --- | --- |
| [`tripLifecycle/`](./tripLifecycle/) | **Core lifecycle** — `detectTripEvents`, `buildTrip`, `processCompletedTrips`, `processCurrentTrips`, predictions, equality, strip-for-storage. `buildTrip` composes `buildTripCore` (schedule + gates) with `applyVesselPredictions` (ML); **`buildTripCore` is exported** for explicit testing (O2) while production injects `buildTrip` via deps. |
| [`processTick/`](./processTick/) | `computeVesselTripsWithClock`, `computeVesselTripsBundle`, adapters, envelope, prediction policy |
| [`continuity/`](./continuity/) | Docked identity continuity |
| [`vesselTripsBuildTripAdapters.ts`](./vesselTripsBuildTripAdapters.ts) | Adapter types for `buildTrip` |

## See also

- [`../architecture.md`](../architecture.md) — full folder map
