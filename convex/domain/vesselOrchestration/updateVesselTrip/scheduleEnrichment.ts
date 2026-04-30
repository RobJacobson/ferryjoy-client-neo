/**
 * Schedule enrichment for already-built active trip rows.
 */

import type {
  ResolvedTripScheduleFields,
} from "domain/vesselOrchestration/updateVesselTrip/tripFields";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

type TripBuildEvents = {
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  leftDockTime: number | undefined;
  scheduleKeyChanged: boolean;
};

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
  const { current } = resolution;
  const withCurrentScheduleFields = {
    ...activeTrip,
    ArrivingTerminalAbbrev:
      current.ArrivingTerminalAbbrev ?? activeTrip.ArrivingTerminalAbbrev,
    ScheduledDeparture:
      current.ScheduledDeparture ?? activeTrip.ScheduledDeparture,
    ScheduleKey: current.ScheduleKey ?? activeTrip.ScheduleKey,
    SailingDay: current.SailingDay ?? activeTrip.SailingDay,
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
    next: resolution.next,
  });
};

/**
 * Attaches next scheduled segment fields while preserving continuity when possible.
 *
 * @param args - Built trip row, prior trip row, and resolved next schedule fields
 * @returns Trip row with next schedule key/departure fields populated or cleared
 */
const attachNextScheduledTripFields = ({
  baseTrip,
  existingTrip,
  next,
}: {
  baseTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  next:
    | {
        NextScheduleKey?: string;
        NextScheduledDeparture?: number;
      }
    | undefined;
}): ConvexVesselTrip => {
  const segmentKey = baseTrip.ScheduleKey;
  if (!segmentKey) {
    return baseTrip;
  }

  if (next) {
    return {
      ...baseTrip,
      NextScheduleKey: next.NextScheduleKey,
      NextScheduledDeparture: next.NextScheduledDeparture,
    };
  }

  if (existingTrip?.ScheduleKey === segmentKey) {
    return {
      ...baseTrip,
      NextScheduleKey: baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  return {
    ...baseTrip,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
  };
};
