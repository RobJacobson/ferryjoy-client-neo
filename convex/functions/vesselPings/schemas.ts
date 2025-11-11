import {
  fromStoredVesselPing,
  type StoredVesselPing,
  toStoredVesselPing,
  type VesselPing,
} from "@domain";
import type { Infer } from "convex/values";
import { v } from "convex/values";

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
export const toConvexVesselPing = (domain: VesselPing): ConvexVesselPing =>
  toStoredVesselPing(domain) as ConvexVesselPing;

/**
 * Convert Convex vessel ping → domain shape
 */
export const fromConvexVesselPing = (convex: ConvexVesselPing): VesselPing =>
  fromStoredVesselPing(convex as StoredVesselPing);
