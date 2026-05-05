/**
 * Selects the schedule resolution path for an active-trip update.
 *
 * The selector keeps evidence ordering separate from row mutation. Complete WSF
 * fields win immediately, rollover inference is limited to in-service new
 * trips, and continuing sparse pings remain read-free.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { UpdateVesselTripDbAccess } from "../types";
import { resolveRolloverScheduleFromContinuity } from "./resolveRolloverScheduleFromContinuity";
import {
  resolveScheduleFromWsfRealtimeFields,
  type WsfCompleteSchedulePing,
} from "./resolveScheduleFromWsfRealtimeFields";
import type { ResolvedTripScheduleFields } from "./types";

type ResolveScheduleForActiveTripInput = {
  currLocation: ConvexVesselLocation;
  prevTrip: ConvexVesselTrip | undefined;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Resolves schedule fields for one active-trip update.
 *
 * WSF realtime fields win when complete. Otherwise, only new in-service trips
 * use continuity inference from prior NextScheduleKey followed by schedule-table
 * lookup. Continuing trips with incomplete WSF fields stay read-free.
 *
 * @param input - Current ping, prior trip, lifecycle signal, and schedule reads
 * @returns Resolved schedule fields when evidence exists, otherwise undefined
 */
const resolveScheduleForActiveTrip = async ({
  currLocation,
  prevTrip,
  isNewTrip,
  dbAccess,
}: ResolveScheduleForActiveTripInput): Promise<
  ResolvedTripScheduleFields | undefined
> => {
  if (hasWsfScheduleFields(currLocation)) {
    return resolveScheduleFromWsfRealtimeFields(currLocation);
  }

  if (!isNewTrip || !currLocation.InService) {
    return undefined;
  }

  const resolution = await resolveRolloverScheduleFromContinuity({
    location: currLocation,
    existingTrip: prevTrip,
    dbAccess,
  });

  if (resolution === undefined) {
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

/**
 * Detects whether a ping carries complete WSF schedule fields.
 *
 * @param location - Vessel location row for this ping
 * @returns True when arriving terminal and scheduled departure are both present
 */
const hasWsfScheduleFields = (
  location: ConvexVesselLocation
): location is WsfCompleteSchedulePing =>
  location.ArrivingTerminalAbbrev !== undefined &&
  location.ScheduledDeparture !== undefined;

export type { ResolveScheduleForActiveTripInput };
export { resolveScheduleForActiveTrip };
