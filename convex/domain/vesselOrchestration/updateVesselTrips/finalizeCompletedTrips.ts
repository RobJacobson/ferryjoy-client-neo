/**
 * Completion branch of the trip-update pipeline.
 *
 * Closes trips that signaled arrival and builds the next active row from the
 * same ping when the lifecycle allows.
 */

import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared";
import { logTripPipelineFailure } from "domain/vesselOrchestration/updateVesselTrips/logTripPipelineFailure";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type { CompletedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * One vessel in the completion batch: stored closed row and optional follow-on
 * active row.
 */
type CompletedTripResolution = {
  completedVesselTrip?: ConvexVesselTrip;
  replacementActiveTrip?: ConvexVesselTrip;
};

/**
 * Builds completed trip rows and replacement active rows for completing vessels.
 *
 * On failure, returns the prior active row as `replacementActiveTrip` so the
 * vessel does not disappear from the active set.
 *
 * @param completedTripUpdates - Vessels closing a trip this ping (prior active required)
 * @param scheduleTables - Prefetched segment tables for schedule enrichment
 * @returns One resolution per completion update (completed row may be omitted on error)
 */
export const finalizeCompletedTrips = (
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>,
  scheduleTables: ScheduledSegmentTables
): ReadonlyArray<CompletedTripResolution> =>
  completedTripUpdates.map((update, index) => {
    try {
      const completedVesselTrip = buildCompletedTrip(
        update.existingActiveTrip,
        update.vesselLocation,
        update.events.didJustArriveAtDock
      );
      const replacementActiveTrip = buildTripCore(
        update.vesselLocation,
        completedVesselTrip,
        true,
        update.events,
        scheduleTables
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
