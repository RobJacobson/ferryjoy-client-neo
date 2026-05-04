/**
 * Defines Convex schemas and wire types for scheduled trips.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
/**
 * Convex validator for scheduled trips
 */
export const scheduledTripSchema = v.object({
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  DepartingTime: v.number(),
  ArrivingTime: v.optional(v.number()),
  SailingNotes: v.string(),
  Annotations: v.array(v.string()),
  RouteID: v.number(),
  RouteAbbrev: v.string(),
  Key: v.string(),
  SailingDay: v.string(), // WSF operational day in YYYY-MM-DD format
  TripType: v.union(v.literal("direct"), v.literal("indirect")),
  DirectKey: v.optional(v.string()),
  PrevKey: v.optional(v.string()),
  NextKey: v.optional(v.string()),
  NextDepartingTime: v.optional(v.number()),
  EstArriveNext: v.optional(v.number()),
  EstArriveCurr: v.optional(v.number()),
  SchedArriveNext: v.optional(v.number()),
  SchedArriveCurr: v.optional(v.number()),
});

/**
 * Type for scheduled trip in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexScheduledTrip = Infer<typeof scheduledTripSchema>;
