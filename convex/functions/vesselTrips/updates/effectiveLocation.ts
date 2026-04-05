/**
 * Normalize docked live locations into an effective trip identity for writes.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { resolveDockedScheduledSegment } from "functions/eventsScheduled/dockedScheduleResolver";
import type { ResolvedVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  applyEffectiveTripIdentityToLocation,
  hasStableDockedTripIdentity,
  resolveEffectiveDockedTripIdentity,
} from "shared/effectiveTripIdentity";
import { getSailingDay } from "shared/time";

/**
 * Resolve the effective location that downstream trip building should use.
 *
 * Raw `vesselLocations` stay feed-shaped, but the write pipeline can complete
 * transiently missing docked identity from the scheduled backbone.
 */
export const resolveEffectiveLocation = async (
  ctx: ActionCtx,
  location: ResolvedVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ResolvedVesselLocation> => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const scheduledResolution = hasStableDockedTripIdentity(
    location,
    existingTrip
  )
    ? null
    : await resolveDockedScheduledSegment(
        {
          getScheduledDepartureSegmentBySegmentKey: (segmentKey) =>
            ctx.runQuery(
              internal.functions.eventsScheduled.queries
                .getScheduledDepartureSegmentBySegmentKey,
              { segmentKey }
            ),
          getNextDepartureSegmentAfterDeparture: (args) =>
            ctx.runQuery(
              internal.functions.eventsScheduled.queries
                .getNextDepartureSegmentAfterDeparture,
              args
            ),
          getDockedDepartureSegmentForVesselAtTerminal: (args) =>
            ctx.runQuery(
              internal.functions.eventsScheduled.queries
                .getDockedDepartureSegmentForVesselAtTerminal,
              args
            ),
        },
        {
          vesselAbbrev: location.VesselAbbrev,
          departingTerminalAbbrev: location.DepartingTerminalAbbrev,
          sailingDay: getSailingDay(new Date(location.TimeStamp)),
          existingTrip,
        }
      );

  return applyEffectiveTripIdentityToLocation(
    location,
    resolveEffectiveDockedTripIdentity({
      location,
      activeTrip: existingTrip,
      scheduledSegment: scheduledResolution?.segment,
      scheduledSegmentSource: scheduledResolution?.source,
    })
  );
};
