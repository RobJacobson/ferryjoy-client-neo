import {
  fromStoredVesselLocation,
  type StoredVesselLocation,
  toStoredVesselLocation,
  type VesselLocation,
} from "@domain";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const vesselLocationValidationSchema = v.object({
  VesselID: v.number(),
  VesselName: v.string(),
  DepartingTerminalID: v.number(),
  DepartingTerminalName: v.string(),
  DepartingTerminalAbbrev: v.string(),
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

export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;

export const toConvexVesselLocation = (
  vl: VesselLocation
): ConvexVesselLocation => toStoredVesselLocation(vl) as ConvexVesselLocation;

export const fromConvexVesselLocation = (
  cvl: ConvexVesselLocation
): VesselLocation => fromStoredVesselLocation(cvl as StoredVesselLocation);
