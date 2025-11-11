import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";

/**
 * Validation schema for individual vessel pings (stored within arrays)
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
 * Inferred type for the convex vessel ping
 */
export type ConvexVesselPing = Infer<typeof vesselPingValidationSchema>;

/**
 * Validation schema for vessel ping collections
 */
export const vesselPingCollectionValidationSchema = v.object({
  timestamp: v.number(), // When this collection was created/stored
  pings: v.array(vesselPingValidationSchema), // Array of vessel pings at this timestamp
});

/**
 * Inferred type for the convex vessel ping collection
 */
export type ConvexVesselPingCollection = Infer<
  typeof vesselPingCollectionValidationSchema
>;

/**
 * Convert a Dottie vessel location to a convex vessel ping
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
  TimeStamp: vl.TimeStamp.getTime(),
});

/**
 * Convert an array of Dottie vessel locations to a convex vessel ping collection
 */
export const toConvexVesselPingCollection = (
  pings: ConvexVesselPing[],
  timestamp: number
): ConvexVesselPingCollection => ({
  timestamp,
  pings,
});
