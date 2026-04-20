# tripLifecycle (updateVesselTrips)

Per-tick vessel trip **state machine**: event detection, **`buildTripCore`**, completed vs active branches, and write-suppression helpers. Wired from **`runUpdateVesselTrips`** → **`computeVesselTripsBundle`** via [`updateVesselOrchestrator`](../../../functions/vesselOrchestrator/actions.ts) with **`createScheduledSegmentLookupFromSnapshot`** after **`getScheduleSnapshotForTick`**.

See [`../README.md`](../README.md) and [`../../architecture.md`](../../architecture.md).
