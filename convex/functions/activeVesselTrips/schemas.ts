import type { Infer } from "convex/values";
import { v } from "convex/values";
import { getVesselAbbreviation } from "src/domain/vesselAbbreviations";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/dateConversion";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";

/**
 * Convex validator for active vessel trips (numbers)
 * This is used in defineTable and function argument validation
 */
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

/**
 * Type for active vessel trip in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexActiveVesselTrip = Infer<typeof activeVesselTripSchema>;

/**
 * Converts vessel location to active trip format
 * Note: location is already in Convex format (numbers), returns Convex format
 */
export const toConvexActiveVesselTrip = (
  location: ConvexVesselLocation,
  tripStart: number
): ConvexActiveVesselTrip => ({
  VesselID: location.VesselID,
  VesselName: location.VesselName ?? "",
  VesselAbbrev: getVesselAbbreviation(location.VesselName ?? ""),
  DepartingTerminalID: location.DepartingTerminalID,
  DepartingTerminalName: location.DepartingTerminalName ?? "",
  DepartingTerminalAbbrev: location.DepartingTerminalAbbrev ?? "",
  ArrivingTerminalID: location.ArrivingTerminalID,
  ArrivingTerminalName: location.ArrivingTerminalName,
  ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  ScheduledDeparture: location.ScheduledDeparture,
  LeftDock: location.LeftDock,
  LeftDockActual: undefined,
  LeftDockDelay: undefined,
  Eta: location.Eta,
  InService: location.InService,
  AtDock: location.AtDock,
  OpRouteAbbrev: location.OpRouteAbbrev,
  VesselPositionNum: location.VesselPositionNum,
  TimeStamp: location.TimeStamp,
  TripStart: tripStart,
});

/**
 * Convert Convex active vessel trip (numbers) to domain active vessel trip (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainActiveVesselTrip = (trip: ConvexActiveVesselTrip) => ({
  VesselID: trip.VesselID,
  VesselName: trip.VesselName,
  VesselAbbrev: trip.VesselAbbrev,
  DepartingTerminalID: trip.DepartingTerminalID,
  DepartingTerminalName: trip.DepartingTerminalName,
  DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
  ArrivingTerminalID: trip.ArrivingTerminalID,
  ArrivingTerminalName: trip.ArrivingTerminalName,
  ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
  ScheduledDeparture: optionalEpochMsToDate(trip.ScheduledDeparture),
  LeftDock: optionalEpochMsToDate(trip.LeftDock),
  LeftDockActual: optionalEpochMsToDate(trip.LeftDockActual),
  LeftDockDelay: trip.LeftDockDelay,
  Eta: optionalEpochMsToDate(trip.Eta),
  InService: trip.InService,
  AtDock: trip.AtDock,
  OpRouteAbbrev: trip.OpRouteAbbrev,
  VesselPositionNum: trip.VesselPositionNum,
  TimeStamp: epochMsToDate(trip.TimeStamp),
  TripStart: epochMsToDate(trip.TripStart),
});

/**
 * Type for active vessel trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type ActiveVesselTrip = ReturnType<typeof toDomainActiveVesselTrip>;
