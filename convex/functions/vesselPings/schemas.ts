import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { dateToEpochMs, epochMsToDate } from "../../shared/dateConversion";

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

export const vesselPingCollectionValidationSchema = v.object({
  timestamp: v.number(),
  pings: v.array(vesselPingValidationSchema),
});

/**
 * Type for vessel ping in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselPing = Infer<typeof vesselPingValidationSchema>;

export type ConvexVesselPingCollection = Infer<
  typeof vesselPingCollectionValidationSchema
>;

/**
 * Convert a Dottie vessel location to a convex vessel ping
 * Manual conversion from Date objects to epoch milliseconds
 */
export const toConvexVesselPing = (
  vl: DottieVesselLocation
): ConvexVesselPing => ({
  VesselID: vl.VesselID,
  Latitude: Math.round(vl.Latitude * 100000) / 100000,
  Longitude: Math.round(vl.Longitude * 100000) / 100000,
  Speed: vl.Speed,
  Heading: vl.Heading,
  AtDock: vl.AtDock,
  TimeStamp: dateToEpochMs(vl.TimeStamp),
});

/**
 * Convert Convex vessel ping (numbers) to domain vessel ping (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainVesselPing = (ping: ConvexVesselPing) => ({
  VesselID: ping.VesselID,
  Latitude: ping.Latitude,
  Longitude: ping.Longitude,
  Speed: ping.Speed,
  Heading: ping.Heading,
  AtDock: ping.AtDock,
  TimeStamp: epochMsToDate(ping.TimeStamp),
});

/**
 * Type for vessel ping in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselPing = ReturnType<typeof toDomainVesselPing>;

/**
 * Convert Convex vessel ping collection (numbers) to domain vessel ping collection (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainVesselPingCollection = (
  collection: ConvexVesselPingCollection
) => ({
  timestamp: epochMsToDate(collection.timestamp),
  pings: collection.pings.map(toDomainVesselPing),
});

/**
 * Type for vessel ping collection in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselPingCollection = ReturnType<
  typeof toDomainVesselPingCollection
>;
