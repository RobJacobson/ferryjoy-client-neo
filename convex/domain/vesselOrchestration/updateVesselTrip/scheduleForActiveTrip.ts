/**
 * Schedule policy application for active-trip rows.
 */

import { applyResolvedTripScheduleFields } from "./scheduleEnrichment";
import { getTripFieldsFromWsf } from "./tripFields/getTripFieldsFromWsf";
import { hasWsfTripFields } from "./tripFields/hasWsfTripFields";
import { resolveTripScheduleFields } from "./tripFields/resolveTripScheduleFields";
import type { UpdateVesselTripDbAccess } from "./types";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

type ApplyScheduleForActiveTripInput = {
  activeTrip: ConvexVesselTrip;
  previousTrip: ConvexVesselTrip | undefined;
  completedTrip: ConvexVesselTrip | undefined;
  location: ConvexVesselLocation;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Applies schedule fields to an active trip under Stage 2 policy gates.
 *
 * @param input - Active trip and continuity context for this ping
 * @returns Active trip row with schedule fields preserved or enriched
 */
export const applyScheduleForActiveTrip = async ({
  activeTrip,
  previousTrip,
  completedTrip,
  location,
  isNewTrip,
  dbAccess,
}: ApplyScheduleForActiveTripInput): Promise<ConvexVesselTrip> => {
  if (hasWsfTripFields(location)) {
    const resolution = {
      current: getTripFieldsFromWsf(location),
      next: undefined,
    };
    return applyResolvedTripScheduleFields({
      activeTrip,
      existingTrip: previousTrip,
      events: {
        isCompletedTrip: isNewTrip,
        didJustArriveAtDock: isNewTrip,
        didJustLeaveDock: false,
        leftDockTime: activeTrip.LeftDock,
        scheduleKeyChanged: previousTrip?.ScheduleKey !== activeTrip.ScheduleKey,
      },
      resolution,
    });
  }

  const isContinuingTrip = previousTrip !== undefined && !isNewTrip;
  if (isContinuingTrip) {
    return activeTrip;
  }

  if (!location.InService) {
    return activeTrip;
  }

  const continuityTrip = previousTrip ?? completedTrip;
  const resolution = await resolveTripScheduleFields({
    location,
    existingTrip: continuityTrip,
    scheduleAccess: dbAccess,
    allowCarriedCurrentFields: !isNewTrip,
  });

  return applyResolvedTripScheduleFields({
    activeTrip,
    existingTrip: continuityTrip,
    events: {
      isCompletedTrip: isNewTrip,
      didJustArriveAtDock: isNewTrip,
      didJustLeaveDock: false,
      leftDockTime: activeTrip.LeftDock,
      scheduleKeyChanged: continuityTrip?.ScheduleKey !== activeTrip.ScheduleKey,
    },
    resolution,
  });
};
