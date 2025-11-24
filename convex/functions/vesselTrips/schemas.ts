import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/dateConversion";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";

/**
 * Convex validator for active vessel trips (numbers)
 * This is used in defineTable and function argument validation
 */
export const vesselTripSchema = v.object({
  // vessel location fields
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
  // vessel trip fields
  TripStart: v.optional(v.number()),
  TripEnd: v.optional(v.number()),
  Distance: v.optional(v.number()),
  AtDockDuration: v.optional(v.number()),
  AtSeaDuration: v.optional(v.number()),
  TotalDuration: v.optional(v.number()),
  Delay: v.optional(v.number()),
});

/**
 * Type for active vessel trip in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselTrip = Infer<typeof vesselTripSchema>;

/**
 * Converts vessel location to active trip format
 * Note: location is already in Convex format (numbers), returns Convex format
 */
export const toConvexVesselTrip = (
  location: ConvexVesselLocation,
  params: {
    TripStart?: number;
    TripEnd?: number;
    Distance?: number;
    AtDockDuration?: number;
    AtSeaDuration?: number;
    TotalDuration?: number;
    Delay?: number;
  }
): ConvexVesselTrip => ({
  ...location,
  ...params,
});

/**
 * Convert Convex active vessel trip (numbers) to domain active vessel trip (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainVesselTrip = (trip: ConvexVesselTrip) => ({
  ...trip,
  ScheduledDeparture: optionalEpochMsToDate(trip.ScheduledDeparture),
  Eta: optionalEpochMsToDate(trip.Eta),
  LeftDock: optionalEpochMsToDate(trip.LeftDock),
  TimeStamp: epochMsToDate(trip.TimeStamp),
  TripStart: optionalEpochMsToDate(trip.TripStart),
  TripEnd: optionalEpochMsToDate(trip.TripEnd),
});

/**
 * Type for active vessel trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselTrip = ReturnType<typeof toDomainVesselTrip>;
