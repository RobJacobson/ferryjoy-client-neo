/**
 * Vessel orchestration domain: top-level package surface for trip-ping entry
 * points plus peer concern namespaces.
 *
 * Post-fetch DB writes for one pass are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * {@link computeVesselTripsRows} for the trip branch. The orchestrator still owns
 * a wall-clock anchor for predictions, timeline (`pingStartedAt`), and schedule
 * snapshot queries — not for the trips domain input alone.
 */

export * as shared from "./shared";
export * as updateTimeline from "./updateTimeline";
export * as updateVesselLocations from "./updateVesselLocations";
export * as updateVesselPredictions from "./updateVesselPredictions";
export { computeVesselTripsRows } from "./updateVesselTrips";

/**
 * Top-level export style:
 * - import trip-ping entry points as named exports from `domain/vesselOrchestration`
 *   or from the owning concern barrel (`updateVesselTrips`, etc.)
 * - import cross-pipeline helpers via `shared` and `updateTimeline`; prediction
 *   runners and types live on the `updateVesselPredictions` namespace
 * - when working entirely inside one concern, prefer that concern's local barrel
 */
