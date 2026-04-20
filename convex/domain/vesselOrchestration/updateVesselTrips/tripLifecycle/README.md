# tripLifecycle (updateVesselTrips)

Per-tick vessel trip **state machine**: event detection, proposed trip build
(`buildTripCore` / `buildTrip`), completed vs active branches, and write-suppression
helpers. Consumed from the orchestrator tick through `runUpdateVesselTrips` →
`computeVesselTripsBundle`
inside [`updateVesselOrchestrator`](../../../functions/vesselOrchestrator/actions.ts)
(`processVesselTrips`),
with `defaultProcessVesselTripsDeps` and **`createScheduledSegmentLookupFromSnapshot`** after **`getScheduleSnapshotForTick`**, plus
`createVesselTripPredictionModelAccess` for the predictions phase.
ML merge and `vesselTripPredictions` upserts run in **`updateVesselPredictions`** after trip apply, not inside the core trip tick builder on the production path.

See [`../README.md`](../README.md) and [`../../architecture.md`](../../architecture.md) §5.
