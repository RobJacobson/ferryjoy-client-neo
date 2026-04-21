# updateVesselTrips

Pure trip-update pipeline for one orchestrator ping.

The public boundary is intentionally small:

- `computeVesselTripsRows(input) -> { completedTrips, activeTrips }` (`ConvexVesselTrip` rows)

Convex table names are `activeVesselTrips` / `completedVesselTrips`; the domain DTO uses shorter `activeTrips` / `completedTrips` for the same row shape.

The concern owns only the work needed to return those arrays. Persistence,
predictions, and timeline assembly must adapt downstream instead of reaching
back into trip-internal artifacts.

## Pipeline

| Path | Role |
| --- | --- |
| [`calculatedTripUpdate.ts`](./calculatedTripUpdate.ts) | Join each feed row to its prior active (by vessel) and run `detectTripEvents` |
| [`tripRowsForVesselPing.ts`](./tripRowsForVesselPing.ts) | For one calculated update, emit optional completed close and/or active row |
| [`computeVesselTripsRows.ts`](./computeVesselTripsRows.ts) | Build schedule tables, map each location through the per-vessel steps, merge actives |
| [`scheduleTripAdapters.ts`](./scheduleTripAdapters.ts) | `ScheduledSegmentLookup` helpers: effective docked location + next-leg schedule |
| [`continuity/`](./continuity/) | Docked identity continuity helpers |
| [`tripLifecycle/`](./tripLifecycle/) | Remaining low-level trip-building helpers that still directly support the pipeline |
