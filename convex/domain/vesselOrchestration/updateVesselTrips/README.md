# updateVesselTrips

Pure trip-update pipeline for one orchestrator tick.

The public boundary is intentionally small:

- `runUpdateVesselTrips(input) -> { completedTrips, activeTrips }` (`ConvexVesselTrip` rows)

Convex table names are `activeVesselTrips` / `completedVesselTrips`; the domain DTO uses shorter `activeTrips` / `completedTrips` for the same row shape.

The concern owns only the work needed to return those arrays. Persistence,
predictions, and timeline assembly must adapt downstream instead of reaching
back into trip-internal artifacts.

## Pipeline

| Path | Role |
| --- | --- |
| [`prepareTripUpdates.ts`](./prepareTripUpdates.ts) | Normalize realtime inputs and existing active trips into per-vessel updates |
| [`finalizeCompletedTrips.ts`](./finalizeCompletedTrips.ts) | Complete prior trips and build replacement active trips when needed |
| [`updateActiveTrips.ts`](./updateActiveTrips.ts) | Build the authoritative active-trip rows for non-completed vessels |
| [`runUpdateVesselTrips.ts`](./runUpdateVesselTrips.ts) | Compose the pipeline and return the two public arrays |
| [`scheduleTripAdapters.ts`](./scheduleTripAdapters.ts) | Schedule snapshot lookups + `VesselTripsBuildTripAdapters` for one tick |
| [`continuity/`](./continuity/) | Docked identity continuity helpers |
| [`tripLifecycle/`](./tripLifecycle/) | Remaining low-level trip-building helpers that still directly support the pipeline |
