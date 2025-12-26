import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

/**
 * Convex validator for vessel trips (numbers)
 * Simplified schema without Status field - table determines status
 */
export const vesselTripSchema = v.object({
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  TripStart: v.optional(v.number()),
  AtDock: v.boolean(),
  AtDockDuration: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  LeftDock: v.optional(v.number()),
  Delay: v.optional(v.number()),
  Eta: v.optional(v.number()),
  TripEnd: v.optional(v.number()),
  AtSeaDuration: v.optional(v.number()),
  TotalDuration: v.optional(v.number()),
  InService: v.boolean(),
  TimeStamp: v.number(),
  // Predicted departure time (absolute timestamp in milliseconds)
  LeftDockPred: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  LeftDockPredMae: v.optional(v.number()),
  // Predicted arrival time (absolute timestamp in milliseconds)
  EtaPred: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  EtaPredMae: v.optional(v.number()),
});

/**
 * Type for active vessel trip in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselTrip = Infer<typeof vesselTripSchema>;

/**
 * Converts vessel location to trip format with simplified schema
 * Note: location is already in Convex format (numbers), returns Convex format
 */
export const toConvexVesselTrip = (
  cvl: ConvexVesselLocation,
  params: {
    TripStart?: number;
    TripEnd?: number;
    AtDockDuration?: number;
    AtSeaDuration?: number;
    TotalDuration?: number;
    Delay?: number;
    // Prediction fields
    LeftDockPred?: number;
    LeftDockPredMae?: number;
    EtaPred?: number;
    EtaPredMae?: number;
  }
): ConvexVesselTrip => ({
  VesselAbbrev: cvl.VesselAbbrev,
  DepartingTerminalAbbrev: cvl.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: cvl.ArrivingTerminalAbbrev,
  AtDock: cvl.AtDock,
  ScheduledDeparture: cvl.ScheduledDeparture,
  Eta: cvl.Eta,
  TimeStamp: cvl.TimeStamp,
  TripStart: params.TripStart,
  TripEnd: params.TripEnd,
  AtDockDuration: params.AtDockDuration,
  LeftDock: cvl.LeftDock,
  AtSeaDuration: params.AtSeaDuration,
  TotalDuration: params.TotalDuration,
  Delay: params.Delay,
  InService: cvl.InService,
  // Prediction fields
  LeftDockPred: params.LeftDockPred,
  LeftDockPredMae: params.LeftDockPredMae,
  EtaPred: params.EtaPred,
  EtaPredMae: params.EtaPredMae,
});

/**
 * Convert Convex vessel trip (numbers) to domain vessel trip (Dates)
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
  // Prediction fields (convert timestamps to Date objects)
  LeftDockPred: optionalEpochMsToDate(trip.LeftDockPred),
  EtaPred: optionalEpochMsToDate(trip.EtaPred),
  // MAE fields remain as numbers (not timestamps)
  LeftDockPredMae: trip.LeftDockPredMae,
  EtaPredMae: trip.EtaPredMae,
});

/**
 * Type for active vessel trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselTrip = ReturnType<typeof toDomainVesselTrip>;
