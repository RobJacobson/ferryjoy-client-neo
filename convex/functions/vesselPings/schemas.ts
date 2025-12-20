import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dateToEpochMs, epochMsToDate } from "shared/convertDates";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";

/**
 * Convex validator for individual vessel pings (numbers)
 * This is used in defineTable and function argument validation
 */
export const vesselPingValidationSchema = v.object({
  VesselID: v.number(),
  Latitude: v.number(),
  Longitude: v.number(),
  Speed: v.number(),
  Heading: v.number(),
  AtDock: v.boolean(),
  TimeStamp: v.number(),
});

/**
 * Convex validator for a collection of vessel pings with timestamp
 * Each document in the vesselPings table will have this structure
 */
export const vesselPingListValidationSchema = v.object({
  timestamp: v.number(),
  pings: v.array(vesselPingValidationSchema),
});

/**
 * Type for vessel ping in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselPing = Infer<typeof vesselPingValidationSchema>;

/**
 * Type for a collection of vessel pings in Convex storage
 * Inferred from the Convex validator
 */
export type ConvexVesselPingCollection = Infer<
  typeof vesselPingListValidationSchema
>;

/**
 * Convert a Dottie vessel location to a convex vessel ping
 * Manual conversion from Date objects to epoch milliseconds
 */
export const toConvexVesselPing = (
  dvl: DottieVesselLocation
): ConvexVesselPing => ({
  VesselID: dvl.VesselID,
  Latitude: Math.round(dvl.Latitude * 100000) / 100000,
  Longitude: Math.round(dvl.Longitude * 100000) / 100000,
  Speed: dvl.Speed,
  Heading: dvl.Heading,
  AtDock: dvl.AtDock,
  TimeStamp: dateToEpochMs(dvl.TimeStamp),
});

/**
 * Convert Convex vessel ping (numbers) to domain vessel ping (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainVesselPing = (ping: ConvexVesselPing) => ({
  ...ping,
  TimeStamp: epochMsToDate(ping.TimeStamp),
});

/**
 * Type for vessel ping in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselPing = ReturnType<typeof toDomainVesselPing>;
