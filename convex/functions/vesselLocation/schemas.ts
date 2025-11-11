import type { Infer } from "convex/values";
import { v } from "convex/values";
import { fromConvexVesselLocation } from "src/domain";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";

export const vesselLocationValidationSchema = v.object({
  VesselID: v.number(),
  VesselName: v.optional(v.string()),
  DepartingTerminalID: v.number(),
  DepartingTerminalName: v.optional(v.string()),
  DepartingTerminalAbbrev: v.optional(v.string()),
  ArrivingTerminalID: v.optional(v.number()),
  ArrivingTerminalName: v.optional(v.string()),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  Latitude: v.number(),
  Longitude: v.number(),
  Speed: v.number(),
  Heading: v.number(),
  InService: v.boolean(),
  AtDock: v.boolean(),
  LeftDock: v.optional(v.number()),
  Eta: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  OpRouteAbbrev: v.optional(v.string()),
  VesselPositionNum: v.optional(v.number()),
  TimeStamp: v.number(),
});

// Export inferred types for use in domain layer
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;

export const toConvexVesselLocation = (
  vl: DottieVesselLocation
): ConvexVesselLocation => ({
  VesselID: vl.VesselID,
  VesselName: vl.VesselName ?? undefined,
  DepartingTerminalID: vl.DepartingTerminalID,
  DepartingTerminalName: vl.DepartingTerminalName ?? undefined,
  DepartingTerminalAbbrev: vl.DepartingTerminalAbbrev ?? undefined,
  ArrivingTerminalID: vl.ArrivingTerminalID ?? undefined,
  ArrivingTerminalName: vl.ArrivingTerminalName ?? undefined,
  ArrivingTerminalAbbrev: vl.ArrivingTerminalAbbrev ?? undefined,
  Latitude: vl.Latitude,
  Longitude: vl.Longitude,
  Speed: vl.Speed,
  Heading: vl.Heading,
  InService: vl.InService,
  AtDock: vl.AtDock,
  LeftDock: vl.LeftDock?.getTime(),
  Eta: vl.Eta?.getTime(),
  ScheduledDeparture: vl.ScheduledDeparture?.getTime(),
  OpRouteAbbrev: vl.OpRouteAbbrev?.[0] ?? undefined,
  VesselPositionNum: vl.VesselPositionNum ?? undefined,
  TimeStamp: vl.TimeStamp.getTime(),
});

// Re-export domain conversion function
export { fromConvexVesselLocation };
