# In-memory schedule fixture (tests only)

This folder is **not** the removed production `vesselOrchestratorScheduleSnapshots` table and is **not** read on the orchestrator hot path.

It provides:

- `ScheduleSnapshot` — an in-memory bag of scheduled departures / segment keys used to build test data.
- `createScheduleContinuityAccessFromSnapshot` — an implementation of `ScheduleContinuityAccess` backed by that in-memory fixture so `updateVesselTrips` / `tripFields` tests can run without Convex `eventsScheduled` queries.

Production uses memoized targeted `eventsScheduled` reads via `functions/vesselOrchestrator/action/pipeline/scheduleContinuity.ts` (`createScheduleContinuityAccess`), which implements the same `ScheduleContinuityAccess` interface.
