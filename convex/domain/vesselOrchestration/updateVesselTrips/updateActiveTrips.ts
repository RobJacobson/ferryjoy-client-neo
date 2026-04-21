/**
 * Active branch of the trip-update pipeline.
 *
 * Updates active trip rows for vessels that did not close a trip this ping.
 */

import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared";
import { logTripPipelineFailure } from "domain/vesselOrchestration/updateVesselTrips/logTripPipelineFailure";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type { CalculatedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Builds updated active trips from non-completing {@link CalculatedTripUpdate}
 * rows.
 *
 * Each row is projected through {@link buildTripCore} with `tripStart: false`.
 * On failure for a vessel, returns the previous active row when one exists so a
 * bad ping does not drop tracking.
 *
 * @param activeTripUpdates - Non-completing calculated rows (may lack prior
 *   active)
 * @param scheduleTables - Prefetched segment tables for schedule enrichment
 * @returns Zero or one trip row per input update
 */
export const updateActiveTrips = (
  activeTripUpdates: ReadonlyArray<CalculatedTripUpdate>,
  scheduleTables: ScheduledSegmentTables
): ReadonlyArray<ConvexVesselTrip> =>
  activeTripUpdates.flatMap((update, index) => {
    try {
      return [
        buildTripCore(
          update.vesselLocation,
          update.existingActiveTrip,
          false,
          update.events,
          scheduleTables
        ),
      ];
    } catch (error) {
      const vesselAbbrev =
        activeTripUpdates[index]?.vesselLocation.VesselAbbrev ?? "unknown";
      logTripPipelineFailure(vesselAbbrev, "updating active trip", error);

      return update.existingActiveTrip !== undefined
        ? [update.existingActiveTrip]
        : [];
    }
  });
