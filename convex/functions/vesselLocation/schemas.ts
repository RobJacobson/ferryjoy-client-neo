import type { Infer } from "convex/values";
import { v } from "convex/values";

import type { VesselLocation } from "@/data/types/VesselLocation";

import {
  toDate,
  toDateOrNull,
  toTimeMs,
  toTimeMsOrUndefined,
  toValOrNull,
  toValOrUndefined,
} from "../utils";

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
): ConvexVesselLocation => ({
  VesselID: vl.VesselID,
  VesselName: vl.VesselName,
  DepartingTerminalID: vl.DepartingTerminalID,
  DepartingTerminalName: vl.DepartingTerminalName,
  DepartingTerminalAbbrev: vl.DepartingTerminalAbbrev,
  ArrivingTerminalID: toValOrUndefined(vl.ArrivingTerminalID),
  ArrivingTerminalName: toValOrUndefined(vl.ArrivingTerminalName),
  ArrivingTerminalAbbrev: toValOrUndefined(vl.ArrivingTerminalAbbrev),
  Latitude: vl.Latitude,
  Longitude: vl.Longitude,
  Speed: vl.Speed,
  Heading: vl.Heading,
  InService: vl.InService,
  AtDock: vl.AtDock,
  LeftDock: toTimeMsOrUndefined(vl.LeftDock),
  Eta: toTimeMsOrUndefined(vl.Eta),
  ScheduledDeparture: toTimeMsOrUndefined(vl.ScheduledDeparture),
  OpRouteAbbrev: toValOrUndefined(vl.OpRouteAbbrev),
  VesselPositionNum: toValOrUndefined(vl.VesselPositionNum),
  TimeStamp: toTimeMs(vl.TimeStamp),
});

export const fromConvexVesselLocation = (
  cvl: ConvexVesselLocation
): VesselLocation => ({
  VesselID: cvl.VesselID,
  VesselName: cvl.VesselName,
  DepartingTerminalID: cvl.DepartingTerminalID,
  DepartingTerminalName: cvl.DepartingTerminalName,
  DepartingTerminalAbbrev: cvl.DepartingTerminalAbbrev,
  ArrivingTerminalID: toValOrNull(cvl.ArrivingTerminalID),
  ArrivingTerminalName: toValOrNull(cvl.ArrivingTerminalName),
  ArrivingTerminalAbbrev: toValOrNull(cvl.ArrivingTerminalAbbrev),
  Latitude: cvl.Latitude,
  Longitude: cvl.Longitude,
  Speed: cvl.Speed,
  Heading: cvl.Heading,
  InService: cvl.InService,
  AtDock: cvl.AtDock,
  LeftDock: toDateOrNull(cvl.LeftDock),
  Eta: toDateOrNull(cvl.Eta),
  ScheduledDeparture: toDateOrNull(cvl.ScheduledDeparture),
  OpRouteAbbrev: toValOrNull(cvl.OpRouteAbbrev),
  VesselPositionNum: toValOrNull(cvl.VesselPositionNum),
  TimeStamp: toDate(cvl.TimeStamp),
});
