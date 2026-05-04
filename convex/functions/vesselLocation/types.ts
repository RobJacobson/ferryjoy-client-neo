/**
 * Defines TS-native vessel-location DTOs and converters for functions callers.
 *
 * Wire rows remain in schemas.ts with epoch-ms timestamps; this module exposes
 * Date-shaped DTOs for in-memory timelines and orchestrator logic.
 */

import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import type { ConvexVesselLocation } from "./schemas";

/**
 * Converts epoch-ms vessel location fields to Date values for TS callers.
 *
 * @param convexVesselLocation - Convex vessel location with numeric timestamps
 * @returns Same record with timestamp fields converted to Date
 */
const toVesselLocation = (convexVesselLocation: ConvexVesselLocation) => ({
  ...convexVesselLocation,
  LeftDock: optionalEpochMsToDate(convexVesselLocation.LeftDock),
  Eta: optionalEpochMsToDate(convexVesselLocation.Eta),
  ScheduledDeparture: optionalEpochMsToDate(
    convexVesselLocation.ScheduledDeparture
  ),
  TimeStamp: epochMsToDate(convexVesselLocation.TimeStamp),
});

/**
 * TS-native vessel location with Date timestamp fields.
 */
type VesselLocation = ReturnType<typeof toVesselLocation>;

export type { VesselLocation };
export { toVesselLocation };
