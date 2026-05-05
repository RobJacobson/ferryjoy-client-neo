/**
 * Applies schedule evidence to active-trip rows.
 *
 * This module owns schedule-field resolution for the already-built active trip
 * row during one orchestrator tick. It chooses authoritative WSF fields first,
 * then new-trip continuity inference, and finally assigns the canonical segment
 * TripKey from the merged ScheduleKey when schedule evidence exists.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { UpdateVesselTripDbAccess } from "../types";
import { mergeResolvedScheduleFields } from "./mergeResolvedScheduleFields";
import { resolveScheduleFromContinuity } from "./resolveScheduleFromContinuity";
import {
  hasWsfScheduleFields,
  resolveScheduleFromWsfFields,
} from "./resolveScheduleFromWsfFields";
import type { ResolvedTripScheduleFields } from "./types";

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

  // Select the highest-confidence source first so merge output is deterministic.
  const resolution = await resolveScheduleFieldsForActiveTrip({
    currLocation,
    prevTrip,
    isNewTrip,
    dbAccess,
  });

  const merged =
    resolution === undefined
      ? activeTrip
      : mergeResolvedScheduleFields({
          activeTrip,
          existingTrip: prevTrip,
          scheduleKeyChanged: prevTrip?.ScheduleKey !== activeTrip.ScheduleKey,
          resolution,
        });

  const tripKey = merged.ScheduleKey ?? prevTrip?.TripKey ?? merged.TripKey;

  return tripKey === merged.TripKey ? merged : { ...merged, TripKey: tripKey };
};

/**
 * Resolves schedule fields for one active-trip update.
 *
 * WSF realtime fields win when complete. Otherwise, only new in-service trips
 * use continuity inference from prior NextScheduleKey followed by schedule-table
 * lookup. Continuing trips with incomplete WSF fields stay read-free.
 *
 * @returns Resolved schedule fields when evidence exists, otherwise undefined
 */
const resolveScheduleFieldsForActiveTrip = async ({
  currLocation,
  prevTrip,
  isNewTrip,
  dbAccess,
}: {
  currLocation: ConvexVesselLocation;
  prevTrip: ConvexVesselTrip | undefined;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
}): Promise<ResolvedTripScheduleFields | undefined> => {
  if (hasWsfScheduleFields(currLocation)) {
    return resolveScheduleFromWsfFields(currLocation);
  }

  if (!isNewTrip || !currLocation.InService) {
    return undefined;
  }

  const resolution = await resolveScheduleFromContinuity({
    location: currLocation,
    existingTrip: prevTrip,
    dbAccess,
  });

  if (resolution === undefined) {
    // Emit an explicit unresolved warning so no-op outcomes are observable during dock-arrival schedule gaps.
    console.warn(
      "[TripFields] unable to identify scheduled trip after new-trip start",
      {
        vesselAbbrev: currLocation.VesselAbbrev,
        departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
        timeStamp: currLocation.TimeStamp,
        existingScheduleKey: prevTrip?.ScheduleKey,
        existingNextScheduleKey: prevTrip?.NextScheduleKey,
      }
    );
  }

  return resolution;
};

export { applyScheduleToActiveTrip };
