/**
 * Projects active trip rows for vessels that are not completing this ping.
 */

import { logTripPipelineFailure } from "domain/vesselOrchestration/updateVesselTrips/logTripPipelineFailure";
import type { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type { VesselTripsBuildTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters";
import type { PreparedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Builds updated active trips from prepared rows; failures fall back to prior active.
 */
export const updateActiveTrips = (
  activeTripUpdates: ReadonlyArray<PreparedTripUpdate>,
  buildTrip: typeof buildTripCore,
  buildTripAdapters: VesselTripsBuildTripAdapters
): ReadonlyArray<ConvexVesselTrip> =>
  activeTripUpdates.flatMap((update, index) => {
    try {
      return [
        buildTrip(
          update.vesselLocation,
          update.existingActiveTrip,
          false,
          update.events,
          buildTripAdapters
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
