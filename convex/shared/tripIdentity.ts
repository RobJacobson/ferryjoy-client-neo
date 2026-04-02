/**
 * Shared trip-identity derivation for live locations and trip state.
 */

import { buildSegmentKey } from "./keys";
import { getSailingDay } from "./time";

export type TripIdentityInput = {
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string | undefined;
  scheduledDepartureMs: number | undefined;
};

export type TripIdentity = {
  Key: string | undefined;
  SailingDay: string | undefined;
  isTripStartReady: boolean;
};

/**
 * Derive the canonical trip identity fields from the minimum component set.
 *
 * `Key` uses Pacific local calendar date semantics through `buildSegmentKey`,
 * while `SailingDay` uses the 3:00 AM service-day grouping via `getSailingDay`.
 */
export const deriveTripIdentity = ({
  vesselAbbrev,
  departingTerminalAbbrev,
  arrivingTerminalAbbrev,
  scheduledDepartureMs,
}: TripIdentityInput): TripIdentity => {
  const departureDate =
    scheduledDepartureMs === undefined
      ? undefined
      : new Date(scheduledDepartureMs);
  const isTripStartReady =
    arrivingTerminalAbbrev !== undefined && scheduledDepartureMs !== undefined;

  return {
    Key: buildSegmentKey(
      vesselAbbrev,
      departingTerminalAbbrev,
      arrivingTerminalAbbrev,
      departureDate
    ),
    SailingDay:
      departureDate === undefined ? undefined : getSailingDay(departureDate),
    isTripStartReady,
  };
};
