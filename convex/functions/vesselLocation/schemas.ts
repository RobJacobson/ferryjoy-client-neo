import type { Infer } from "convex/values";
import { v } from "convex/values";
import { getVesselAbbreviation } from "src/domain/vesselAbbreviations";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import {
  dateToEpochMs,
  epochMsToDate,
  optionalDateToEpochMs,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

/**
 * Convex validator for vessel locations (numbers)
 * This is used in defineTable and function argument validation
 */
export const vesselLocationValidationSchema = v.object({
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
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
  DepartingDistance: v.optional(v.number()),
  ArrivingDistance: v.optional(v.number()),
});

/**
 * Type for vessel location in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;

/**
 * Convert a Dottie vessel location to a convex vessel location.
 * Manual conversion from Date objects to epoch milliseconds.
 * @param dvl - Dottie vessel location with Date objects
 * @returns Convex vessel location with numeric timestamps
 */
export const toConvexVesselLocation = (
  dvl: DottieVesselLocation
): ConvexVesselLocation => ({
  VesselID: dvl.VesselID,
  VesselName: dvl.VesselName ?? "",
  VesselAbbrev: getVesselAbbreviation(dvl.VesselName ?? ""),
  DepartingTerminalID: dvl.DepartingTerminalID,
  DepartingTerminalName: dvl.DepartingTerminalName ?? "",
  DepartingTerminalAbbrev: dvl.DepartingTerminalAbbrev ?? "",
  ArrivingTerminalID: dvl.ArrivingTerminalID ?? undefined,
  ArrivingTerminalName: dvl.ArrivingTerminalName ?? undefined,
  ArrivingTerminalAbbrev: dvl.ArrivingTerminalAbbrev ?? undefined,
  Latitude: dvl.Latitude,
  Longitude: dvl.Longitude,
  Speed: dvl.Speed,
  Heading: dvl.Heading,
  InService: dvl.InService,
  AtDock: dvl.AtDock,
  LeftDock: optionalDateToEpochMs(dvl.LeftDock),
  Eta: optionalDateToEpochMs(dvl.Eta),
  ScheduledDeparture: optionalDateToEpochMs(dvl.ScheduledDeparture),
  OpRouteAbbrev: dvl.OpRouteAbbrev?.[0] ?? undefined,
  VesselPositionNum: dvl.VesselPositionNum ?? undefined,
  TimeStamp: dateToEpochMs(dvl.TimeStamp),
  DepartingDistance: undefined,
  ArrivingDistance: undefined,
});

/**
 * Convert Convex vessel location (numbers) to domain vessel location (Dates).
 * Manual conversion from epoch milliseconds to Date objects.
 * @param cvl - Convex vessel location with numeric timestamps
 * @returns Domain vessel location with Date objects
 */
export const toDomainVesselLocation = (cvl: ConvexVesselLocation) => ({
  ...cvl,
  LeftDock: optionalEpochMsToDate(cvl.LeftDock),
  Eta: optionalEpochMsToDate(cvl.Eta),
  ScheduledDeparture: optionalEpochMsToDate(cvl.ScheduledDeparture),
  TimeStamp: epochMsToDate(cvl.TimeStamp),
});

/**
 * Type for vessel location in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselLocation = ReturnType<typeof toDomainVesselLocation>;
