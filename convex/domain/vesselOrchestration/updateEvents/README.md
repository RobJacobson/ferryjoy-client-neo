# updateEvents (domain projection)

Direct trip-delta projection to sparse `eventsActual` / `eventsPredicted` writes for one ping.

## Production orchestrator wiring

`projectEventsFromTripDelta` takes `{ pingStartedAt, tripUpdate, enrichedActiveVesselTrip }` and returns `{ actualEvents, predictedEvents, updateLeaveDockEventPatch? }`. Leave-dock ML actualization is derived from the same dock transition facts as actual dep-dock rows.

`computeVesselUpdatePlan` in `functions/vesselOrchestrator/actions/ping/computeVesselUpdatePlan.ts` runs trip compute, prediction enrichment, event projection, and storage stripping before `persistVesselUpdates`.

## Production call chain

1. `updateVesselOrchestrator` / `runOrchestratorPing` — load identities, update locations, loop changed vessels.
2. Per changed vessel: `computeVesselUpdatePlan` → `VesselUpdatePlan | null` (skip when null).
3. `persistVesselUpdates` — atomic trip, event, and optional leave-dock patch writes.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `projectEventsFromTripDelta.ts` | Direct projector from trip delta + enriched active trip |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `contracts.ts` | Public input/output types |
| `index.ts` | Public barrel |

## See also

- [`../architecture.md`](../architecture.md)
- [Orchestrator module README](../../../functions/vesselOrchestrator/README.md)
