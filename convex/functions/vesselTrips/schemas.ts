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
  // Denormalized previous trip data for efficient predictions
  prevAtSeaDuration: v.optional(v.number()), // Previous trip's at-sea duration in minutes
  prevDelay: v.optional(v.number()), // Previous trip's departure delay in minutes
  // Predicted departure delay (in minutes)
  DelayPred: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  DelayPredMae: v.optional(v.number()),
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
    // Denormalized previous trip data
    prevAtSeaDuration?: number;
    prevDelay?: number;
    // Prediction fields
    DelayPred?: number;
    DelayPredMae?: number;
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
  // Denormalized previous trip data
  prevAtSeaDuration: params.prevAtSeaDuration,
  prevDelay: params.prevDelay,
  // Prediction fields
  DelayPred: params.DelayPred,
  DelayPredMae: params.DelayPredMae,
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
  // Prediction fields
  DelayPred: trip.DelayPred, // Delay in minutes (not a timestamp)
  EtaPred: optionalEpochMsToDate(trip.EtaPred), // ETA is still a timestamp
  // MAE fields remain as numbers (not timestamps)
  DelayPredMae: trip.DelayPredMae,
  EtaPredMae: trip.EtaPredMae,
});

/**
 * A vessel trip that has all required fields for making predictions.
 * This is a subset of ConvexVesselTrip where prediction-critical fields are guaranteed to be present.
 */
export type PredictionReadyTrip = ConvexVesselTrip & {
  ScheduledDeparture: number;
  ArrivingTerminalAbbrev: string;
  TripStart: number;
  prevDelay: number;
  prevAtSeaDuration: number;
};

/**
 * Type guard to check if a trip has all required fields for predictions
 */
export const isPredictionReady = (
  trip: ConvexVesselTrip
): trip is PredictionReadyTrip =>
  trip.ScheduledDeparture !== undefined &&
  trip.ArrivingTerminalAbbrev !== undefined &&
  trip.TripStart !== undefined &&
  trip.prevDelay !== undefined &&
  trip.prevAtSeaDuration !== undefined;

/**
 * Type for active vessel trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselTrip = ReturnType<typeof toDomainVesselTrip>;
