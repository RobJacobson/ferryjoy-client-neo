# updateVesselTrips (orchestrator concern)

**Trip branch** logic (invoked from [`updateVesselOrchestrator`](../../../functions/vesselOrchestrator/actions.ts) via the canonical **`runUpdateVesselTrips`** boundary): the full **lifecycle** implementation used on each cron tick.

The public story for this concern is:

- `runUpdateVesselTrips(input) -> { activeTrips, completedTrips }`

Function-layer persistence may consume the internal tick bundle that powers
those arrays, but that write-shaping detail is not part of this concern's
public contract.

## Layout

| Path | Role |
| --- | --- |
| [`tripLifecycle/`](./tripLifecycle/) | **Core lifecycle** — `detectTripEvents`, `buildTripCore`, `processCompletedTrips`, `processCurrentTrips`, equality. Production **`createDefaultProcessVesselTripsDeps`** wires **`buildTripCore` only**. |
| [`processTick/`](./processTick/) | `computeVesselTripsBundle`, adapters, and the internal bundle consumed by function-layer persistence |
| [`continuity/`](./continuity/) | Docked identity continuity |
| [`vesselTripsBuildTripAdapters.ts`](./vesselTripsBuildTripAdapters.ts) | Adapter types for `buildTripCore` |

## See also

- [`../architecture.md`](../architecture.md) — full folder map
