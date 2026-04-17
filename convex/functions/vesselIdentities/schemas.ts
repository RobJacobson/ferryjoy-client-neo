/**
 * Convex schema and types for canonical vessel identity records.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

export const vesselIdentitySchema = v.object({
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
});

export type VesselIdentity = Infer<typeof vesselIdentitySchema>;
