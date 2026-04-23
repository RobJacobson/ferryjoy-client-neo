import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * WSF is authoritative for trip fields when it provides the two direct fields
 * we cannot safely infer from partial feed data alone. `ScheduleKey` may still
 * be derived from those fields when WSF omits it.
 */
export const hasWsfTripFields = (
  location: Pick<
    ConvexVesselLocation,
    "ArrivingTerminalAbbrev" | "ScheduledDeparture"
  >
): boolean =>
  location.ArrivingTerminalAbbrev !== undefined &&
  location.ScheduledDeparture !== undefined;
