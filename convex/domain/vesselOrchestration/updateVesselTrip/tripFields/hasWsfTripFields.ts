import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * WSF is authoritative for trip fields when it provides the two direct fields
 * we cannot safely infer from partial feed data alone. `ScheduleKey` may still
 * be derived from those fields when WSF omits it.
 *
 * @param location - Raw vessel location for this ping
 * @returns True when both arriving terminal and scheduled departure are present
 */
export const hasWsfTripFields = (location: ConvexVesselLocation): boolean =>
  location.ArrivingTerminalAbbrev !== undefined &&
  location.ScheduledDeparture !== undefined;
