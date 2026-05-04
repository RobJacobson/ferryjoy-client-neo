/**
 * Validators and wire types for individual vessel ping rows stored in Convex.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Convex validator for one vessel ping document (one row per ping).
 */
export const vesselPingValidationSchema = v.object({
  VesselAbbrev: v.string(),
  Latitude: v.number(),
  Longitude: v.number(),
  Speed: v.number(),
  Heading: v.number(),
  AtDock: v.boolean(),
  TimeStamp: v.number(),
});

/**
 * Type for a vessel ping row stored in Convex with numeric timestamps.
 */
export type ConvexVesselPing = Infer<typeof vesselPingValidationSchema>;
