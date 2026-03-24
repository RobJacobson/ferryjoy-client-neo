/**
 * Defines the historic vessel-location schema and related types.
 */
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { vesselLocationValidationFields } from "functions/vesselLocation/schemas";

/**
 * Convex validator for historic vessel-location snapshots.
 * Matches the live vessel-location shape plus SailingDay.
 */
export const historicVesselLocationValidationSchema = v.object({
  ...vesselLocationValidationFields,
  SailingDay: v.string(),
});

/**
 * Type for a historic vessel-location snapshot in Convex storage.
 */
export type ConvexHistoricVesselLocation = Infer<
  typeof historicVesselLocationValidationSchema
>;
