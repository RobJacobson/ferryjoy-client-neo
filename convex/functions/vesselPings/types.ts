/**
 * Defines TS-native vessel-ping DTOs and converters for functions callers.
 */

import { epochMsToDate } from "../../shared/convertDates";
import type { ConvexVesselPing } from "./schemas";

/**
 * TS-native vessel ping with Date timestamp.
 */
type VesselPing = Omit<ConvexVesselPing, "TimeStamp"> & {
  TimeStamp: Date;
};

/**
 * Maps a stored Convex vessel ping to the TS-native shape.
 *
 * @param convexVesselPing - Convex vessel ping with epoch TimeStamp
 * @returns Vessel ping with Date timestamp
 */
const toVesselPing = (convexVesselPing: ConvexVesselPing): VesselPing => ({
  VesselAbbrev: convexVesselPing.VesselAbbrev,
  Latitude: convexVesselPing.Latitude,
  Longitude: convexVesselPing.Longitude,
  Speed: convexVesselPing.Speed,
  Heading: convexVesselPing.Heading,
  AtDock: convexVesselPing.AtDock,
  TimeStamp: epochMsToDate(convexVesselPing.TimeStamp),
});

export type { VesselPing };
export { toVesselPing };
