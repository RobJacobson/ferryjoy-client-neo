/**
 * Defines the slim vessel-location update signature schema and related types.
 */
import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Minimal per-vessel update signature used for dedupe checks.
 */
export const vesselLocationUpdateValidationSchema = v.object({
  VesselAbbrev: v.string(),
  TimeStamp: v.number(),
  VesselLocationId: v.optional(v.id("vesselLocations")),
});

/**
 * Type for a vessel-location update signature in Convex storage.
 */
export type ConvexVesselLocationUpdate = Infer<
  typeof vesselLocationUpdateValidationSchema
>;
