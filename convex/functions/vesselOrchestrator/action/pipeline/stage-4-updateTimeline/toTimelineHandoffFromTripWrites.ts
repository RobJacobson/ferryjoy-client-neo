/**
 * Adapter for timeline handoff shaping from trip writes.
 */

import type { PersistedTripTimelineHandoff } from "domain/vesselOrchestration/shared";
import type { UpdatedTrips } from "../stage-2-updateVesselTrip/tripWrites";

/**
 * Converts updated trips into the timeline handoff input shape.
 *
 * @param updatedTrips - Sparse updated trips produced for the current vessel
 * @returns Timeline handoff used by the timeline projection stage
 */
export const toTimelineHandoffFromUpdatedTrips = (
  updatedTrips: UpdatedTrips
): PersistedTripTimelineHandoff => ({
  completedTripFacts:
    updatedTrips.completedVesselTrip === undefined
      ? []
      : [updatedTrips.completedVesselTrip],
  currentBranch: {
    successfulVesselAbbrev: updatedTrips.activeVesselTrip?.VesselAbbrev,
    pendingActualWrite: updatedTrips.actualDockWrite,
    pendingPredictedWrite: updatedTrips.predictedDockWrite,
  },
});
