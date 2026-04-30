/**
 * Schedule policy application for active-trip rows.
 *
 * Entry point chooses among:
 * - Path A — authoritative WSF destination + scheduled departure on the ping.
 * - Path B — new-trip rollover while in service: infer from schedule tables.
 * - Neither — return the built active trip unchanged.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { applyResolvedTripScheduleFields } from "./scheduleEnrichment";
import {
  resolveScheduleFromTripArrival,
} from "./tripFields/resolveScheduleFromTripArrival";
import {
  hasWsfScheduleFields,
  resolveScheduleFromWsfRealtime,
} from "./tripFields/resolveScheduleFromWsfRealtime";
import type { ResolvedTripScheduleFields } from "./tripFields/types";
import type { UpdateVesselTripDbAccess } from "./types";

type ApplyScheduleForActiveTripInput = {
  /** Active trip row built for this ping (before schedule merge). */
  curr: ConvexVesselTrip;
  /** Prior stored active trip for this vessel, when any. */
  prev: ConvexVesselTrip | undefined;
  location: ConvexVesselLocation;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Applies schedule fields to an active trip.
 *
 * Dispatches path A (WSF-authoritative), path B (schedule-table inference on
 * start of a new trip), or leaves the built row unchanged.
 *
 * @param args - Built active trip (`curr`), prior active row (`prev`), ping context
 * @returns Active trip row with schedule fields preserved or enriched; if
 *   unchanged, returns `curr`
 */
export const applyScheduleForActiveTrip = async (
  args: ApplyScheduleForActiveTripInput
): Promise<ConvexVesselTrip> => {
  const { curr, prev, location, isNewTrip, dbAccess } = args;
  let resolution: ResolvedTripScheduleFields | undefined;

  if (hasWsfScheduleFields(location)) {
    resolution = resolveScheduleFromWsfRealtime(location);
  } else if (shouldInferScheduleFromTablesForNewTrip(location, isNewTrip)) {
    resolution = await resolveScheduleFromTripArrival({
      location,
      existingTrip: prev,
      scheduleAccess: dbAccess,
    });
  }

  if (resolution === undefined) {
    return curr;
  }

  return applyResolvedTripScheduleFields({
    activeTrip: curr,
    existingTrip: prev,
    scheduleKeyChanged: prev?.ScheduleKey !== curr.ScheduleKey,
    resolution,
  });
};

/**
 * Path B: schedule-table inference is allowed (trip rollover, vessel in service).
 *
 * @param location - Vessel location row for this ping
 * @param isNewTrip - Ping signals start of a replacement active trip
 * @returns True when async schedule evidence lookup may run
 */
const shouldInferScheduleFromTablesForNewTrip = (
  location: ConvexVesselLocation,
  isNewTrip: boolean
): boolean => isNewTrip && location.InService;
