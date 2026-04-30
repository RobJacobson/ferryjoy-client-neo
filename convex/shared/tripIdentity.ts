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
  /** Schedule composite segment id (not physical trip instance identity). */
  ScheduleKey: string | undefined;
  SailingDay: string | undefined;
  /** Legacy schedule-alignment readiness for trip-start gating. */
  isTripStartReady: boolean;
};

/**
 * Derive schedule-facing identity fields from the minimum component set.
 *
 * This helper remains schedule-oriented during Stage 1. Physical boundary
 * timestamps live on the trip row contract and are not interpreted here.
 *
 * `ScheduleKey` uses Pacific local calendar date semantics through
 * `buildSegmentKey`, while `SailingDay` uses the 3:00 AM service-day grouping
 * via `getSailingDay`.
 */
export const deriveTripIdentity = ({
  vesselAbbrev,
  departingTerminalAbbrev,
  arrivingTerminalAbbrev,
  scheduledDepartureMs,
}: TripIdentityInput): TripIdentity => {
  const isTripStartReady =
    arrivingTerminalAbbrev !== undefined && scheduledDepartureMs !== undefined;

  if (scheduledDepartureMs === undefined) {
    return {
      ScheduleKey: undefined,
      SailingDay: undefined,
      isTripStartReady,
    };
  }

  const departureDate = new Date(scheduledDepartureMs);
  return {
    ScheduleKey: buildSegmentKey(
      vesselAbbrev,
      departingTerminalAbbrev,
      arrivingTerminalAbbrev,
      departureDate
    ),
    SailingDay: getSailingDay(departureDate),
    isTripStartReady,
  };
};
