# updateVesselTrips

Pure trip-update pipeline for one orchestrator ping.

The public boundary is intentionally small:

- `computeVesselTripsRows(input) -> { completedTrips, activeTrips }` (`ConvexVesselTrip` rows)

Internal helpers such as per-vessel update packaging, storage equality, and
trip-field inference stay on direct file imports so the exported surface keeps
the architectural contract centered on `updateVesselTrips`.

Convex table names are `activeVesselTrips` / `completedVesselTrips`; the domain DTO uses shorter `activeTrips` / `completedTrips` for the same row shape.

The concern owns only the work needed to return those arrays. Persistence,
predictions, and timeline assembly must adapt downstream instead of reaching
back into trip-internal artifacts.

## Pipeline

| Path | Role |
| --- | --- |
| [`calculatedTripUpdate.ts`](./calculatedTripUpdate.ts) | Join each feed row to its prior active (by vessel) and run `detectTripEvents` |
| [`tripRowsForVesselPing.ts`](./tripRowsForVesselPing.ts) | For one calculated update, emit optional completed close and/or active row |
| [`computeVesselTripUpdates.ts`](./computeVesselTripUpdates.ts) | Canonical internal one-vessel seam: package the per-vessel trip outcome plus lifecycle/storage flags |
| [`computeVesselTripsRows.ts`](./computeVesselTripsRows.ts) | Narrow the schedule snapshot into schedule evidence, map each location through the per-vessel steps, merge actives |
| [`tripFields/`](./tripFields/) | Canonical owner of inferred trip fields: prefer WSF when present, otherwise infer provisional trip fields from schedule evidence |
| [`tripLifecycle/`](./tripLifecycle/) | Physical lifecycle detection plus base-trip builders that consume already-prepared locations |
