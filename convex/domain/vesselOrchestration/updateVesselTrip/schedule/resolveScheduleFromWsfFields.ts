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
 * Builds schedule resolution from authoritative WSF realtime fields.
 *
 * This resolver treats complete WSF schedule fields as the highest-confidence
 * source and derives a canonical segment key from vessel, terminals, and
 * scheduled departure. Returning a full current-leg payload here lets merge
 * logic bypass continuity lookups and keep schedule identity deterministic.
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
      // Keep sailing-day derivation tied to scheduled departure for stable persisted schedule identity.
      SailingDay: getSailingDay(departureDate),
      tripFieldResolutionMethod: "wsfRealtimeFields",
    },
    next: undefined,
  };
};

export type { WsfCompleteSchedulePing };
export { resolveScheduleFromWsfFields };
