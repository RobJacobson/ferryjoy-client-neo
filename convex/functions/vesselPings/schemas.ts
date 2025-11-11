import type { Infer } from "convex/values";
import { v } from "convex/values";

import type { VesselPing } from "@/data/types/VesselPing";

/**
 * Validation schema for vessel pings stored in Convex
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
 * Convex vessel ping type inferred from validation schema
 */
export type ConvexVesselPing = Infer<typeof vesselPingValidationSchema>;

/**
 * Convert domain vessel ping → Convex shape
 */
export const toConvexVesselPing = (domain: VesselPing): ConvexVesselPing => ({
  VesselID: domain.VesselID,
  Latitude: domain.Latitude,
  Longitude: domain.Longitude,
  Speed: domain.Speed,
  Heading: domain.Heading,
  AtDock: domain.AtDock,
  TimeStamp: domain.TimeStamp.getTime(),
});

/**
 * Convert Convex vessel ping → domain shape
 */
export const fromConvexVesselPing = (convex: ConvexVesselPing): VesselPing => ({
  VesselID: convex.VesselID,
  Latitude: convex.Latitude,
  Longitude: convex.Longitude,
  Speed: convex.Speed,
  Heading: convex.Heading,
  AtDock: convex.AtDock,
  TimeStamp: new Date(convex.TimeStamp),
});
