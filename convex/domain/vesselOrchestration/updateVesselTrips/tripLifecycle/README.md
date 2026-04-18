# tripLifecycle (updateVesselTrips)

Per-tick vessel trip **state machine**: event detection, proposed trip build
(including **updateVesselPredictions**), completed vs active branches, and
write-suppression helpers. Consumed only from the orchestrator tick path
(`processVesselTripsWithDeps` → `defaultProcessVesselTripsDeps` + `createScheduledSegmentLookup` + `createVesselTripPredictionModelAccess` via `createVesselOrchestratorTickDeps` in `vesselOrchestrator/createVesselOrchestratorTickDeps.ts`).

See [`../README.md`](../README.md) and [`../../architecture.md`](../../architecture.md) §5.
