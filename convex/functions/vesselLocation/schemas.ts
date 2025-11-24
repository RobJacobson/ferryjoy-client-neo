import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import {
  dateToEpochMs,
  epochMsToDate,
  optionalDateToEpochMs,
  optionalEpochMsToDate,
} from "../../shared/dateConversion";

/**
 * Convex validator for vessel locations (numbers)
 * This is used in defineTable and function argument validation
 */
export const vesselLocationValidationSchema = v.object({
  VesselID: v.number(),
  VesselName: v.optional(v.string()),
  VesselAbbrev: v.optional(v.string()),
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

/**
 * Type for vessel location in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;

/**
 * Convert a Dottie vessel location to a convex vessel location
 * Manual conversion from Date objects to epoch milliseconds
 */
export const toConvexVesselLocation = (
  vl: DottieVesselLocation
): ConvexVesselLocation => ({
  VesselID: vl.VesselID,
  VesselName: vl.VesselName ?? undefined,
  DepartingTerminalID: vl.DepartingTerminalID,
  DepartingTerminalName: vl.DepartingTerminalName || "",
  DepartingTerminalAbbrev: vl.DepartingTerminalAbbrev || "",
  ArrivingTerminalID: vl.ArrivingTerminalID ?? undefined,
  ArrivingTerminalName: vl.ArrivingTerminalName ?? undefined,
  ArrivingTerminalAbbrev: vl.ArrivingTerminalAbbrev ?? undefined,
  Latitude: vl.Latitude,
  Longitude: vl.Longitude,
  Speed: vl.Speed,
  Heading: vl.Heading,
  InService: vl.InService,
  AtDock: vl.AtDock,
  LeftDock: optionalDateToEpochMs(vl.LeftDock),
  Eta: optionalDateToEpochMs(vl.Eta),
  ScheduledDeparture: optionalDateToEpochMs(vl.ScheduledDeparture),
  OpRouteAbbrev: vl.OpRouteAbbrev?.[0] ?? undefined,
  VesselPositionNum: vl.VesselPositionNum ?? undefined,
  TimeStamp: dateToEpochMs(vl.TimeStamp),
});

/**
 * Convert Convex vessel location (numbers) to domain vessel location (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainVesselLocation = (location: ConvexVesselLocation) => ({
  VesselID: location.VesselID,
  VesselName: location.VesselName,
  DepartingTerminalID: location.DepartingTerminalID,
  DepartingTerminalName: location.DepartingTerminalName,
  DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
  ArrivingTerminalID: location.ArrivingTerminalID,
  ArrivingTerminalName: location.ArrivingTerminalName,
  ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  Latitude: location.Latitude,
  Longitude: location.Longitude,
  Speed: location.Speed,
  Heading: location.Heading,
  InService: location.InService,
  AtDock: location.AtDock,
  LeftDock: optionalEpochMsToDate(location.LeftDock),
  Eta: optionalEpochMsToDate(location.Eta),
  ScheduledDeparture: optionalEpochMsToDate(location.ScheduledDeparture),
  OpRouteAbbrev: location.OpRouteAbbrev,
  VesselPositionNum: location.VesselPositionNum,
  TimeStamp: epochMsToDate(location.TimeStamp),
});

/**
 * Type for vessel location in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselLocation = ReturnType<typeof toDomainVesselLocation>;
