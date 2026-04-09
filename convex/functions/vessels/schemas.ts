/**
 * Convex schema and types for canonical vessel identity records.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

export const vesselSchema = v.object({
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
  UpdatedAt: v.optional(v.number()),
});

export type Vessel = Infer<typeof vesselSchema>;
