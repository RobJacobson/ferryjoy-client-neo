/**
 * Pure same-sailing-day ownership helpers for VesselTimeline attachment.
 */

import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import {
  findDockedDepartureEvent,
  getSegmentKeyFromBoundaryKey,
} from "../../functions/eventsScheduled/segmentResolvers";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";

/**
 * Resolves the docked trip key from same-day scheduled events plus live state.
 *
 * This helper intentionally stays within the requested sailing day. If the
 * same-day schedule slice cannot prove which departure owns the current dock
 * interval, the timeline read path returns `null` rather than looking across
 * sailing-day boundaries or consulting composite trip tables.
 *
 * @param args.scheduledEvents - Scheduled boundary events for the requested sailing day
 * @param args.location - Current live vessel-location row, when available
 * @returns Docked trip key inferred from same-day events, or `null`
 */
export const resolveInferredDockedTripKey = ({
  scheduledEvents,
  location,
}: {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  location: ConvexVesselLocation | null;
}) => {
  if (!location || !location.AtDock || location.Key) {
    return null;
  }

  const departureEvent = findDockedDepartureEvent(
    scheduledEvents,
    location.DepartingTerminalAbbrev,
    location.TimeStamp
  );

  return departureEvent ? getSegmentKeyFromBoundaryKey(departureEvent.Key) : null;
};
