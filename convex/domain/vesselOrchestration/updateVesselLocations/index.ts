/**
 * Orchestrator concern **updateVesselLocations**: live vessel location snapshot
 * batch for each tick. Convex I/O stays in `functions/vesselOrchestrator` (or
 * `functions/vesselLocation`); this folder owns tick wiring like
 * {@link runUpdateVesselLocationsTick}.
 */

export { runUpdateVesselLocationsTick } from "./runUpdateVesselLocationsTick";
