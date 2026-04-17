/**
 * Orchestrator concern **updateVesselLocations**: live vessel location snapshot
 * batch for each tick. Convex I/O stays in `functions/vesselOrchestrator` (or
 * `functions/vesselLocation`); this folder owns the domain-shaped args.
 */

export { bulkUpsertArgsFromConvexLocations } from "./bulkUpsertArgsFromLocations";
export { runUpdateVesselLocationsTick } from "./runUpdateVesselLocationsTick";
