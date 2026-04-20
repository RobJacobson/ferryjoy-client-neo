/**
 * Completes in-flight trips and projects the next active row per completion update.
 */

import { logTripPipelineFailure } from "domain/vesselOrchestration/updateVesselTrips/logTripPipelineFailure";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type { VesselTripsBuildTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters";
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
  buildCompleted: typeof buildCompletedTrip,
  buildTrip: typeof buildTripCore,
  buildTripAdapters: VesselTripsBuildTripAdapters
): ReadonlyArray<CompletedTripResolution> =>
  completedTripUpdates.map((update, index) => {
    try {
      const completedVesselTrip = buildCompleted(
        update.existingActiveTrip,
        update.vesselLocation,
        update.events.didJustArriveAtDock
      );
      const replacementActiveTrip = buildTrip(
        update.vesselLocation,
        completedVesselTrip,
        true,
        update.events,
        buildTripAdapters
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
