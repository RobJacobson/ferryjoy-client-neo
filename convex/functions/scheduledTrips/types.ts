/**
 * Defines TS-native scheduled-trip DTOs and converters for functions callers.
 *
 * Wire rows remain in schemas.ts with epoch-ms timestamps; this module exposes
 * Date-shaped scheduled trips used by reads and in-memory pipeline logic.
 */

import { epochMsToDate } from "../../shared/convertDates";
import type { ConvexScheduledTrip } from "./schemas";

/**
 * Converts a Convex scheduled trip to the TS-native Date-shaped DTO.
 *
 * @param convexScheduledTrip - Convex scheduled trip with numeric timestamps
 * @returns Scheduled trip with Date timestamp fields
 */
const toScheduledTrip = (
  convexScheduledTrip: ConvexScheduledTrip & {
    DisplayArrivingTerminalAbbrev?: string;
  }
) => ({
  ...convexScheduledTrip,
  DepartingTime: epochMsToDate(convexScheduledTrip.DepartingTime),
  ArrivingTime: convexScheduledTrip.ArrivingTime
    ? epochMsToDate(convexScheduledTrip.ArrivingTime)
    : undefined,
  EstArriveNext: convexScheduledTrip.EstArriveNext
    ? epochMsToDate(convexScheduledTrip.EstArriveNext)
    : undefined,
  EstArriveCurr: convexScheduledTrip.EstArriveCurr
    ? epochMsToDate(convexScheduledTrip.EstArriveCurr)
    : undefined,
  SchedArriveNext: convexScheduledTrip.SchedArriveNext
    ? epochMsToDate(convexScheduledTrip.SchedArriveNext)
    : undefined,
  SchedArriveCurr: convexScheduledTrip.SchedArriveCurr
    ? epochMsToDate(convexScheduledTrip.SchedArriveCurr)
    : undefined,
  NextDepartingTime: convexScheduledTrip.NextDepartingTime
    ? epochMsToDate(convexScheduledTrip.NextDepartingTime)
    : undefined,
});

/**
 * TS-native scheduled trip with Date timestamp fields.
 */
type ScheduledTrip = ReturnType<typeof toScheduledTrip>;

export type { ScheduledTrip };
export { toScheduledTrip };
