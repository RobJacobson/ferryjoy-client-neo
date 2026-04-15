# Convex domain modules

Vessel sailing-day timeline logic is split by pipeline:

- **`timelineBackbone/`** — Query-time merge and ordering of scheduled, actual, and predicted rows (`buildTimelineBackbone`).
- **`timelineReseed/`** — Same-day reseed: schedule seeding, history hydration, live reconciliation (`buildReseedTimelineSlice` and related helpers).
- **`timelineRows/`** — Shared row builders and projection helpers used by backbone, reseed, and mutations.
- **`scheduledTrips/`** — Schedule transformation for `ConvexScheduledTrip` rows: direct/indirect classification, estimates, official crossing-time policy, and the `runScheduleTransformPipeline` entrypoint (used by the functions-layer sync adapter and timeline reseed).
- **`vesselTrips/`** — Vessel active-trip lifecycle for orchestrator ticks: `processVesselTripsWithDeps`, `buildTrip`, projection assembly, and related helpers. **`vesselTrips/continuity/`** holds schedule-backed docked continuity (`resolveDockedScheduledSegment`, `resolveEffectiveDockedLocation`). The functions layer wires default `buildTripAdapters` (`resolveEffectiveLocation`, `appendFinalSchedule`).

Import these modules directly; there is no `vesselTimeline` domain barrel.
