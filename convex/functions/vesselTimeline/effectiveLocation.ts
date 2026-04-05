/**
 * Normalize docked timeline locations into an effective trip identity for reads.
 */

import type { QueryCtx } from "_generated/server";
import {
  findDockedDepartureSegmentForVesselAtTerminal,
  findNextDepartureSegmentAfterDeparture,
  findScheduledDepartureSegmentBySegmentKey,
} from "functions/eventsScheduled/queries";
import { resolveDockedScheduledSegment } from "functions/eventsScheduled/dockedScheduleResolver";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  applyEffectiveTripIdentityToLocation,
  hasStableDockedTripIdentity,
  resolveEffectiveDockedTripIdentity,
} from "shared/effectiveTripIdentity";

/**
 * Resolve the effective location that timeline attachment should consume.
 */
export const resolveEffectiveTimelineLocation = async (
  ctx: QueryCtx,
  location: ConvexVesselLocation,
  activeTrip: ConvexVesselTrip | null
): Promise<ConvexVesselLocation> => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const scheduledResolution = hasStableDockedTripIdentity(location, activeTrip)
    ? null
    : await resolveDockedScheduledSegment(
        {
          getScheduledDepartureSegmentBySegmentKey: (segmentKey) =>
            findScheduledDepartureSegmentBySegmentKey(ctx, segmentKey),
          getNextDepartureSegmentAfterDeparture: (args) =>
            findNextDepartureSegmentAfterDeparture(ctx, args),
          getDockedDepartureSegmentForVesselAtTerminal: (args) =>
            findDockedDepartureSegmentForVesselAtTerminal(ctx, args),
        },
        {
          vesselAbbrev: location.VesselAbbrev,
          departingTerminalAbbrev: location.DepartingTerminalAbbrev,
          observedAt: location.TimeStamp,
          existingTrip: activeTrip ?? undefined,
        }
      );

  return applyEffectiveTripIdentityToLocation(
    location,
    resolveEffectiveDockedTripIdentity({
      location,
      activeTrip,
      scheduledSegment: scheduledResolution?.segment,
      scheduledSegmentSource: scheduledResolution?.source,
    })
  );
};
