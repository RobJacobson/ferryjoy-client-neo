# tripLifecycle (updateVesselTrips)

Per-tick vessel trip **state machine**: event detection, proposed trip build
(including **updateVesselPredictions**), completed vs active branches, and
write-suppression helpers. Consumed only from the orchestrator tick path
(`computeVesselTripTickWritePlan` / `runProcessVesselTripsTick` → `defaultProcessVesselTripsDeps` + `createScheduledSegmentLookup` + `createVesselTripPredictionModelAccess` as wired by `executeVesselOrchestratorTick` in `functions/vesselOrchestrator/executeVesselOrchestratorTick.ts`).

See [`../README.md`](../README.md) and [`../../architecture.md`](../../architecture.md) §5.
