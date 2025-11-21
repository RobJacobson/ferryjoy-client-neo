import { zodToConvex } from "convex-helpers/server/zod";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { z } from "zod";

import { epochMillisToDate } from "../../shared/codecs";

/**
 * Zod schema for individual vessel pings (domain representation with Date)
 * This is the single source of truth for vessel ping structure
 * Exported for use in domain layer conversion functions
 */
export const vesselPingSchema = z.object({
  VesselID: z.number(),
  Latitude: z.number(),
  Longitude: z.number(),
  Speed: z.number(),
  Heading: z.number(),
  AtDock: z.boolean(),
  TimeStamp: epochMillisToDate, // Date in domain, number in Convex
});

/**
 * Convex validator for vessel pings (converted from Zod schema)
 * This is used in defineTable and function argument validation
 */
export const vesselPingValidationSchema = zodToConvex(vesselPingSchema);

/**
 * Type for vessel ping in domain layer (with Date objects)
 * Inferred from the Zod schema
 */
export type VesselPing = z.infer<typeof vesselPingSchema>;

/**
 * Type for vessel ping in Convex storage (with numbers)
 * Uses z.input to get the input type of the codec (numbers), not the output type (Dates)
 */
export type ConvexVesselPing = z.input<typeof vesselPingSchema>;

/**
 * Zod schema for vessel ping collections
 */
export const vesselPingCollectionSchema = z.object({
  timestamp: epochMillisToDate, // Date in domain, number in Convex
  pings: z.array(vesselPingSchema),
});

/**
 * Convex validator for vessel ping collections
 */
export const vesselPingCollectionValidationSchema = zodToConvex(
  vesselPingCollectionSchema
);

/**
 * Type for vessel ping collection in domain layer (with Date objects)
 * Inferred from the Zod schema
 */
export type VesselPingCollection = z.infer<typeof vesselPingCollectionSchema>;

/**
 * Type for vessel ping collection in Convex storage (with numbers)
 * Uses z.input to get the input type of the codec (numbers), not the output type (Dates)
 */
export type ConvexVesselPingCollection = z.input<
  typeof vesselPingCollectionSchema
>;

/**
 * Convert a Dottie vessel location to a convex vessel ping
 * Uses Zod schema's encode to automatically convert Date to number
 */
export const toConvexVesselPing = (
  vl: DottieVesselLocation
): ConvexVesselPing => {
  // Create domain representation with Date
  const domainPing = {
    VesselID: vl.VesselID,
    Latitude: Math.round(vl.Latitude * 100000) / 100000,
    Longitude: Math.round(vl.Longitude * 100000) / 100000,
    Speed: vl.Speed,
    Heading: vl.Heading,
    AtDock: vl.AtDock,
    TimeStamp: vl.TimeStamp, // Already a Date
  };

  // Encode to Convex format (Date -> number)
  // The encode method returns the input type (numbers), which matches ConvexVesselPing
  // Using 'unknown' first because TypeScript can't properly infer the encoded type
  return vesselPingSchema.encode(domainPing) as unknown as ConvexVesselPing;
};

/**
 * Convert an array of convex vessel pings and timestamp to a convex vessel ping collection
 * Note: pings are already in Convex format (numbers), timestamp is a number
 */
export const toConvexVesselPingCollection = (
  pings: ConvexVesselPing[],
  timestamp: number
): ConvexVesselPingCollection => {
  // Pings are already in Convex format, timestamp is already a number
  // TypeScript can't properly infer ConvexVesselPingCollection from Infer<typeof validator>
  // when the validator comes from a Zod schema with codecs, so we use a type assertion
  const result = {
    timestamp,
    pings,
  } as unknown as ConvexVesselPingCollection;
  return result;
};

/**
 * Convert Convex vessel ping (numbers) to domain vessel ping (Dates)
 * Uses Zod schema's decode to automatically convert numbers to Dates
 */
export const toDomainVesselPing = (ping: ConvexVesselPing) =>
  vesselPingSchema.decode(ping);
