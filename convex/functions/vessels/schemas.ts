/**
 * Convex schema and types for canonical vessel identity records.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { VesselAbbrev, VesselName } from "../../shared/identity";

export const vesselSchema = v.object({
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
  UpdatedAt: v.optional(v.number()),
});

export type Vessel = Infer<typeof vesselSchema>;

export type ResolvedVesselRecord = Omit<
  Vessel,
  "VesselName" | "VesselAbbrev"
> & {
  VesselName: VesselName;
  VesselAbbrev: VesselAbbrev;
};
