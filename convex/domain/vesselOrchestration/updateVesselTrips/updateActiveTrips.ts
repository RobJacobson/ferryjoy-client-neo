/**
 * Projects active trip rows for vessels that are not completing this tick.
 */

import type { TripPipelineDeps } from "domain/vesselOrchestration/updateVesselTrips/createTripPipelineDeps";
import { logTripPipelineFailure } from "domain/vesselOrchestration/updateVesselTrips/logTripPipelineFailure";
import type { PreparedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Builds updated active trips from prepared rows; failures fall back to prior active.
 */
export const updateActiveTrips = (
  activeTripUpdates: ReadonlyArray<PreparedTripUpdate>,
  deps: Pick<TripPipelineDeps, "buildTripCore" | "buildTripAdapters">
): ReadonlyArray<ConvexVesselTrip> =>
  activeTripUpdates.flatMap((update, index) => {
    try {
      return [
        deps.buildTripCore(
          update.vesselLocation,
          update.existingActiveTrip,
          false,
          update.events,
          deps.buildTripAdapters
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
