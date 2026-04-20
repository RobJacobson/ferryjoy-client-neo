/**
 * Completes in-flight trips and projects the next active row per completion update.
 */

import type { TripPipelineDeps } from "domain/vesselOrchestration/updateVesselTrips/createTripPipelineDeps";
import { logTripPipelineFailure } from "domain/vesselOrchestration/updateVesselTrips/logTripPipelineFailure";
import type { CompletedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** One completion tick: closed row plus optional replacement active trip. */
type CompletedTripResolution = {
  completedVesselTrip?: ConvexVesselTrip;
  replacementActiveTrip?: ConvexVesselTrip;
};

/**
 * Builds completed trip rows and follow-on active trips; errors keep prior active.
 */
export const finalizeCompletedTrips = (
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>,
  deps: Pick<
    TripPipelineDeps,
    "buildCompletedTrip" | "buildTripCore" | "buildTripAdapters"
  >
): ReadonlyArray<CompletedTripResolution> =>
  completedTripUpdates.map((update, index) => {
    try {
      const completedVesselTrip = deps.buildCompletedTrip(
        update.existingActiveTrip,
        update.vesselLocation,
        update.events.didJustArriveAtDock
      );
      const replacementActiveTrip = deps.buildTripCore(
        update.vesselLocation,
        completedVesselTrip,
        true,
        update.events,
        deps.buildTripAdapters
      );

      return {
        completedVesselTrip,
        replacementActiveTrip,
      };
    } catch (error) {
      const vesselAbbrev =
        completedTripUpdates[index]?.vesselLocation.VesselAbbrev ?? "unknown";
      logTripPipelineFailure(vesselAbbrev, "finalizing completed trip", error);

      return {
        replacementActiveTrip: update.existingActiveTrip,
      };
    }
  });
