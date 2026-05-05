/**
 * WSF realtime branch helpers for resolving schedule-facing fields on active
 * trips when the ping carries destination and scheduled departure.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { ResolvedCurrentTripFields } from "./types";

/** Ping used only after the WSF-complete guard (destination + scheduled departure). */
export type WsfCompleteSchedulePing = ConvexVesselLocation & {
  ScheduledDeparture: number;
  ArrivingTerminalAbbrev: string;
};

/**
 * Builds resolved current-trip fields from authoritative WSF feed values.
 *
 * @param location - Ping with ScheduledDeparture and ArrivingTerminalAbbrev
 *   set after the WSF-complete guard; those fields are required. Callers must
 *   use the WSF-complete schedule branch guard.
 * @returns Schedule-only fields: segment ScheduleKey from buildSegmentKey,
 *   SailingDay from getSailingDay, and
 *   resolution method tag. Callers merge with destination and departure on the
 *   ping into resolution current when applying to a trip row.
 */
export const getTripFieldsFromWsf = (
  location: WsfCompleteSchedulePing
): ResolvedCurrentTripFields => {
  const departureDate = new Date(location.ScheduledDeparture);
  return {
    ScheduleKey: buildSegmentKey(
      location.VesselAbbrev,
      location.DepartingTerminalAbbrev,
      location.ArrivingTerminalAbbrev,
      departureDate
    ),
    SailingDay: getSailingDay(departureDate),
    tripFieldResolutionMethod: "wsfRealtimeFields",
  };
};
