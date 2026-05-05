/**
 * Resolves schedule fields from complete WSF realtime ping fields.
 *
 * This is the authoritative schedule path for active-trip updates. When WSF
 * supplies both destination and scheduled departure, those feed fields define
 * the current segment identity without schedule-table reads.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { ResolvedTripScheduleFields } from "./types";

type WsfCompleteSchedulePing = ConvexVesselLocation & {
  ScheduledDeparture: number;
  ArrivingTerminalAbbrev: string;
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

/**
 * Builds schedule resolution from authoritative WSF realtime fields.
 *
 * @param location - Ping with arriving terminal and scheduled departure set
 * @returns Resolution current/next shapes for schedule merge
 */
const resolveScheduleFromWsfFields = (
  location: WsfCompleteSchedulePing
): ResolvedTripScheduleFields => {
  const departureDate = new Date(location.ScheduledDeparture);
  return {
    current: {
      ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
      ScheduledDeparture: location.ScheduledDeparture,
      ScheduleKey: buildSegmentKey(
        location.VesselAbbrev,
        location.DepartingTerminalAbbrev,
        location.ArrivingTerminalAbbrev,
        departureDate
      ),
      SailingDay: getSailingDay(departureDate),
      tripFieldResolutionMethod: "wsfRealtimeFields",
    },
    next: undefined,
  };
};

export type { WsfCompleteSchedulePing };
export { hasWsfScheduleFields, resolveScheduleFromWsfFields };
