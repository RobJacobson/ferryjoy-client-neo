/**
 * Vessel orchestration domain: top-level package surface for trip-tick entry
 * points plus peer concern namespaces.
 *
 * Post-fetch DB writes for one pass are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * {@link runUpdateVesselTrips} for the trip branch. The orchestrator still owns
 * `tickStartedAt` for predictions, timeline, and schedule snapshot queries —
 * not for the trips domain input.
 */

export * as shared from "./shared";
export * as updateTimeline from "./updateTimeline";
export * as updateVesselLocations from "./updateVesselLocations";
export * as updateVesselPredictions from "./updateVesselPredictions";
export { runUpdateVesselTrips } from "./updateVesselTrips";

/**
 * Top-level export style:
 * - import trip-tick entry points as named exports from `domain/vesselOrchestration`
 *   or from the owning concern barrel (`updateVesselTrips`, etc.)
 * - import cross-pipeline helpers via the `shared`, `updateVesselPredictions`,
 *   and `updateTimeline` namespaces exposed here
 * - when working entirely inside one concern, prefer that concern's local barrel
 */
