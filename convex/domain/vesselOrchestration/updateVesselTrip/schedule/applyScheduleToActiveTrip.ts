/**
 * Applies schedule evidence to active-trip rows.
 *
 * This module applies selected schedule evidence to the already-built active
 * trip row during one orchestrator tick. It delegates path selection, merges
 * resolved fields, and assigns the final TripKey policy.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { UpdateVesselTripDbAccess } from "../types";
import { mergeScheduleResolutionIntoTrip } from "./mergeScheduleResolutionIntoTrip";
import { resolveScheduleForActiveTrip } from "./resolveScheduleForActiveTrip";

type ApplyScheduleToActiveTripInput = {
  activeTrip: ConvexVesselTrip;
  prevTrip: ConvexVesselTrip | undefined;
  currLocation: ConvexVesselLocation;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Applies schedule fields to an active trip.
 *
 * This function is the schedule-policy entry point for one active-trip update.
 * It chooses between authoritative realtime WSF fields and new-trip continuity
 * inference from schedule evidence, then forwards any resolved payload to the
 * centralized merge layer. When no evidence applies, it returns the built trip
 * unchanged so the pipeline can continue without forcing weak schedule values.
 *
 * @param args - Active trip row, prior row, current ping, lifecycle signal, and schedule read access
 * @returns Active trip row with schedule fields preserved or enriched and
 *   canonical TripKey assigned; same reference as the built active trip input
 *   when schedule merge and TripKey are both no-ops
 */
const applyScheduleToActiveTrip = async (
  args: ApplyScheduleToActiveTripInput
): Promise<ConvexVesselTrip> => {
  const { activeTrip, prevTrip, currLocation, isNewTrip, dbAccess } = args;

  const resolution = await resolveScheduleForActiveTrip({
    currLocation,
    prevTrip,
    isNewTrip,
    dbAccess,
  });

  const merged =
    resolution === undefined
      ? activeTrip
      : mergeScheduleResolutionIntoTrip({
          activeTrip,
          existingTrip: prevTrip,
          scheduleKeyChanged: prevTrip?.ScheduleKey !== activeTrip.ScheduleKey,
          resolution,
        });

  const tripKey = resolveTripKeyForScheduleOutcome({
    mergedTrip: merged,
    prevTrip,
    isNewTrip,
    hasResolution: resolution !== undefined,
  });

  return tripKey === merged.TripKey ? merged : { ...merged, TripKey: tripKey };
};

/**
 * Resolves the active-row trip key after schedule policy has run.
 *
 * Resolved schedule evidence provides the canonical trip identity. Continuing
 * sparse pings may retain the prior key, while replacement trips without
 * schedule evidence must keep only their own provisional identity so they do
 * not inherit the completed leg.
 *
 * @param input - Merged trip, prior trip, lifecycle signal, and resolution state
 * @returns Trip key to persist on the active row
 */
const resolveTripKeyForScheduleOutcome = ({
  mergedTrip,
  prevTrip,
  isNewTrip,
  hasResolution,
}: {
  mergedTrip: ConvexVesselTrip;
  prevTrip: ConvexVesselTrip | undefined;
  isNewTrip: boolean;
  hasResolution: boolean;
}): string => {
  if (mergedTrip.ScheduleKey !== undefined) {
    return mergedTrip.ScheduleKey;
  }

  if (!hasResolution && !isNewTrip && prevTrip?.TripKey !== undefined) {
    return prevTrip.TripKey;
  }

  return mergedTrip.TripKey;
};

export { applyScheduleToActiveTrip };
