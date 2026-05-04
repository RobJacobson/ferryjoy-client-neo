import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Builds a stable key for matching completed-handoff facts to ML overlays.
 *
 * @param vesselAbbrev - Vessel abbreviation for the completed handoff
 * @param completedTrip - Completed trip row from the handoff
 * @param activeTrip - Replacement schedule trip row from the handoff
 * @returns Stable vessel+schedule identity key
 */
export const buildCompletedHandoffKey = (
  vesselAbbrev: string,
  completedTrip: ConvexVesselTrip | undefined,
  activeTrip: ConvexVesselTrip | undefined
): string => {
  const scheduleIdentity =
    completedTrip?.ScheduleKey ??
    completedTrip?.TripKey ??
    activeTrip?.ScheduleKey ??
    activeTrip?.TripKey ??
    "";
  return `${vesselAbbrev}::${scheduleIdentity}`;
};
