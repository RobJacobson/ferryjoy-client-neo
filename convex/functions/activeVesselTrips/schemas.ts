import type { Infer } from "convex/values";
import { v } from "convex/values";

// Schema for database storage (Convex format with undefined for optional fields)
export const activeVesselTripSchema = v.object({
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
  DepartingTerminalID: v.number(),
  DepartingTerminalName: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalID: v.optional(v.number()),
  ArrivingTerminalName: v.optional(v.string()),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  ScheduledDeparture: v.optional(v.number()),
  LeftDock: v.optional(v.number()),
  LeftDockActual: v.optional(v.number()),
  LeftDockDelay: v.optional(v.number()),
  Eta: v.optional(v.number()),
  InService: v.boolean(),
  AtDock: v.boolean(),
  OpRouteAbbrev: v.optional(v.string()),
  VesselPositionNum: v.optional(v.number()),
  TimeStamp: v.number(),
  TripStart: v.number(),
});

// Export inferred types for use in domain layer
export type ConvexActiveVesselTrip = Infer<typeof activeVesselTripSchema>;
