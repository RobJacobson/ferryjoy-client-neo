/**
 * Schedule enrichment for already-built active trip rows.
 */

import type { ScheduleDbAccess } from "domain/vesselOrchestration/shared";
import {
  attachNextScheduledTripFields,
  resolveTripScheduleFields,
  type ResolvedTripScheduleFields,
} from "domain/vesselOrchestration/updateVesselTrip/tripFields";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import type { TripBuildEvents } from "./basicTripRows";

/**
 * Applies resolved schedule-facing fields to an already-built active trip.
 *
 * @param activeTrip - Basic active trip row
 * @param existingTrip - Prior trip row used for schedule continuity
 * @param events - Lifecycle events for this ping
 * @param resolution - Resolved current/next schedule fields
 * @returns Active trip row with current and next schedule fields finalized
 */
export const applyResolvedTripScheduleFields = ({
  activeTrip,
  existingTrip,
  events,
  resolution,
}: {
  activeTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  events: TripBuildEvents;
  resolution: ResolvedTripScheduleFields;
}): ConvexVesselTrip => {
  const { resolvedCurrentTripFields } = resolution;
  const withCurrentScheduleFields = {
    ...activeTrip,
    ArrivingTerminalAbbrev:
      resolvedCurrentTripFields.ArrivingTerminalAbbrev ??
      activeTrip.ArrivingTerminalAbbrev,
    ScheduledDeparture:
      resolvedCurrentTripFields.ScheduledDeparture ??
      activeTrip.ScheduledDeparture,
    ScheduleKey:
      resolvedCurrentTripFields.ScheduleKey ?? activeTrip.ScheduleKey,
    SailingDay:
      resolvedCurrentTripFields.SailingDay ?? activeTrip.SailingDay,
  };
  const withDerivedScheduleFields = {
    ...withCurrentScheduleFields,
    TripDelay: calculateTimeDelta(
      withCurrentScheduleFields.ScheduledDeparture,
      withCurrentScheduleFields.LeftDock
    ),
  };

  // Clear next-leg schedule hints when physical identity or schedule anchor flips.
  const physicalIdentityReplaced =
    existingTrip?.TripKey !== undefined &&
    withDerivedScheduleFields.TripKey !== undefined &&
    existingTrip.TripKey !== withDerivedScheduleFields.TripKey;
  const scheduleAttachmentLost =
    existingTrip?.ScheduleKey !== undefined &&
    withDerivedScheduleFields.ScheduleKey === undefined;
  const scheduleSafeTrip =
    events.scheduleKeyChanged &&
    (physicalIdentityReplaced || scheduleAttachmentLost)
      ? {
          ...withDerivedScheduleFields,
          NextScheduleKey: undefined,
          NextScheduledDeparture: undefined,
        }
      : withDerivedScheduleFields;

  return attachNextScheduledTripFields({
    baseTrip: scheduleSafeTrip,
    existingTrip,
    inferredNext: resolution.inferredNext,
  });
};

/**
 * Resolves and applies schedule fields after basic active row construction.
 *
 * @param activeTrip - Basic active trip row
 * @param existingTrip - Prior trip row used for schedule continuity
 * @param vesselLocation - Incoming vessel location ping
 * @param events - Lifecycle events for this ping
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Active trip row with schedule fields enriched
 */
export const enrichActiveTripWithSchedule = async (
  activeTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined,
  vesselLocation: ConvexVesselLocation,
  events: TripBuildEvents,
  scheduleAccess: ScheduleDbAccess
): Promise<ConvexVesselTrip> => {
  const resolution = await resolveTripScheduleFields({
    location: vesselLocation,
    existingTrip,
    scheduleAccess,
  });

  return applyResolvedTripScheduleFields({
    activeTrip,
    existingTrip,
    events,
    resolution,
  });
};
