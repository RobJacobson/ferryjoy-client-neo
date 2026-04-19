# updateVesselTrips (orchestrator concern)

**Trip branch** logic (invoked from [`updateVesselOrchestrator`](../../../functions/vesselOrchestrator/actions.ts) via the canonical **`runUpdateVesselTrips`** boundary): the full **lifecycle** implementation used on each cron tick.

The public story for this concern is:

- `runUpdateVesselTrips(input) -> { activeTrips, completedTrips, tripComputations }`

Functions-layer persistence may translate those DTOs into Convex mutations, but
that persistence shape is not the concern's public contract.

## Layout

| Path | Role |
| --- | --- |
| [`tripLifecycle/`](./tripLifecycle/) | **Core lifecycle** — `detectTripEvents`, `buildTrip`, `processCompletedTrips`, `processCurrentTrips`, predictions, equality, strip-for-storage. `buildTrip` composes `buildTripCore` (schedule + gates) with `applyVesselPredictions` (ML); **`buildTripCore` is exported** for explicit testing (O2) while production injects `buildTrip` via deps. |
| [`processTick/`](./processTick/) | `computeVesselTripsWithClock`, `computeVesselTripsBundle`, adapters, envelope, prediction policy |
| [`continuity/`](./continuity/) | Docked identity continuity |
| [`vesselTripsBuildTripAdapters.ts`](./vesselTripsBuildTripAdapters.ts) | Adapter types for `buildTrip` |

## See also

- [`../architecture.md`](../architecture.md) — full folder map
