`shared/` holds cross-cutting vessel-orchestrator domain code that is used by more than one pipeline or by the orchestrator itself. This is the home for schedule snapshot contracts, shared handshake types, and other artifacts that are not owned exclusively by `updateVesselTrips/`, `updateVesselPredictions/`, or `updateTimeline/`.

`shared/` is not a second trip-pipeline bucket. Keep trip-tick internals, query-time read helpers, and single-pipeline implementation details in their owning modules instead of promoting them here just for convenience.
