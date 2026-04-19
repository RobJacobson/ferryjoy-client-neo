# updateVesselTrips (orchestrator concern)

**Trip branch** logic (invoked from [`updateVesselOrchestrator`](../../../functions/vesselOrchestrator/actions.ts) via the canonical **`runUpdateVesselTrips`** boundary): the full **lifecycle** implementation used on each cron tick.

The public story for this concern is:

- `runUpdateVesselTrips(input) -> { activeTrips, completedTrips, tripComputations }`

Functions-layer persistence may translate those DTOs into Convex mutations, but
that persistence shape is not the concern's public contract.

## Layout

| Path | Role |
| --- | --- |
| [`tripLifecycle/`](./tripLifecycle/) | **Core lifecycle** — `detectTripEvents`, `buildTripCore`, `buildTrip` (test-only composer: core + `applyVesselPredictions`), `processCompletedTrips`, `processCurrentTrips`, equality. Production **`createDefaultProcessVesselTripsDeps`** wires **`buildTripCore` only**; ML attaches in **updateVesselPredictions**. |
| [`processTick/`](./processTick/) | `computeVesselTripsWithClock`, `computeVesselTripsBundle`, adapters, sub-minute fallback policy (shared with prediction gates) |
| [`continuity/`](./continuity/) | Docked identity continuity |
| [`vesselTripsBuildTripAdapters.ts`](./vesselTripsBuildTripAdapters.ts) | Adapter types for `buildTrip` |

## See also

- [`../architecture.md`](../architecture.md) — full folder map
