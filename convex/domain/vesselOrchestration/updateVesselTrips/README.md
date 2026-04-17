# updateVesselTrips (orchestrator concern)

**Trip branch** logic for `runVesselOrchestratorTick`: eligibility gates plus the full
**lifecycle** implementation used on each cron tick.

## Layout

| Path | Role |
| --- | --- |
| [`passengerTerminalEligibility.ts`](./passengerTerminalEligibility.ts) | Which locations run through trip processing |
| [`tripLifecycle/`](./tripLifecycle/) | **Core lifecycle** — `detectTripEvents`, `buildTrip`, `processCompletedTrips`, `processCurrentTrips`, predictions, equality, strip-for-storage |
| [`processTick/`](./processTick/) | Tick entry (`processVesselTripsWithDeps`), adapters, envelope, prediction policy |
| [`continuity/`](./continuity/) | Docked identity continuity |
| [`read/`](./read/) | Query-time merge/dedupe helpers |
| [`mutations/`](./mutations/) | Domain mutation policy helpers (e.g. depart-next) |
| [`vesselTripsBuildTripAdapters.ts`](./vesselTripsBuildTripAdapters.ts) | Adapter types for `buildTrip` |

## See also

- [`../architecture.md`](../architecture.md) — full folder map
