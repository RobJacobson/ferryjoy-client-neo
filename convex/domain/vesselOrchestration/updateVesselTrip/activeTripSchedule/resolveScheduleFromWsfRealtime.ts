/**
 * WSF realtime schedule resolution for active-trip schedule enrichment.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  getTripFieldsFromWsf,
  type WsfCompleteSchedulePing,
} from "./getTripFieldsFromWsf";
import type { ResolvedTripScheduleFields } from "./types";

/**
 * Detects whether a ping carries complete WSF schedule fields.
 *
 * @param location - Vessel location row for this ping
 * @returns True when arriving terminal and scheduled departure are both present
 */
export const hasWsfScheduleFields = (
  location: ConvexVesselLocation
): location is WsfCompleteSchedulePing =>
  location.ArrivingTerminalAbbrev !== undefined &&
  location.ScheduledDeparture !== undefined;

/**
 * Builds Path A schedule resolution from authoritative WSF realtime fields.
 *
 * @param location - Ping satisfying {@link WsfCompleteSchedulePing}
 * @returns Resolution current/next shapes for schedule merge
 */
export const resolveScheduleFromWsfRealtime = (
  location: WsfCompleteSchedulePing
): ResolvedTripScheduleFields => ({
  current: {
    ...getTripFieldsFromWsf(location),
    ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    ScheduledDeparture: location.ScheduledDeparture,
  },
  next: undefined,
});
