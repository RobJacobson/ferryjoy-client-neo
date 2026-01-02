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
  TripDelay: v.optional(v.number()), // Departure delay in minutes (LeftDock - ScheduledDeparture)
  Eta: v.optional(v.number()),
  TripEnd: v.optional(v.number()),
  AtSeaDuration: v.optional(v.number()),
  TotalDuration: v.optional(v.number()),
  InService: v.boolean(),
  TimeStamp: v.number(),
  // Denormalized previous trip data for efficient predictions
  PrevScheduledDeparture: v.optional(v.number()), // Previous trip's scheduled departure time in milliseconds
  PrevLeftDock: v.optional(v.number()), // Previous trip's left dock time in milliseconds
  // Predicted departure delay (in minutes)
  TripDelayPred: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  TripDelayMae: v.optional(v.number()),
  // Predicted arrival time based on arrival (arrive-arrive model, absolute timestamp in milliseconds)
  ArriveEtaPred: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  ArriveEtaMae: v.optional(v.number()),
  // Predicted arrival time based on departure (depart-arrive model, absolute timestamp in milliseconds)
  DepartEtaPred: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  DepartEtaMae: v.optional(v.number()),
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
    // Denormalized previous trip data
    PrevScheduledDeparture?: number;
    PrevLeftDock?: number;
    // Prediction fields
    TripDelayPred?: number;
    TripDelayMae?: number;
    ArriveEtaPred?: number;
    ArriveEtaMae?: number;
    DepartEtaPred?: number;
    DepartEtaMae?: number;
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
  LeftDock: cvl.LeftDock,
  InService: cvl.InService,
  // Denormalized previous trip data
  PrevScheduledDeparture: params.PrevScheduledDeparture,
  PrevLeftDock: params.PrevLeftDock,
  // Prediction fields
  TripDelayPred: params.TripDelayPred,
  TripDelayMae: params.TripDelayMae,
  ArriveEtaPred: params.ArriveEtaPred,
  ArriveEtaMae: params.ArriveEtaMae,
  DepartEtaPred: params.DepartEtaPred,
  DepartEtaMae: params.DepartEtaMae,
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
  TripDelayPred: trip.TripDelayPred, // Delay in minutes (not a timestamp)
  ArriveEtaPred: optionalEpochMsToDate(trip.ArriveEtaPred), // ETA is still a timestamp
  DepartEtaPred: optionalEpochMsToDate(trip.DepartEtaPred), // ETA is still a timestamp
  // MAE fields remain as numbers (not timestamps)
  TripDelayMae: trip.TripDelayMae,
  ArriveEtaMae: trip.ArriveEtaMae,
  DepartEtaMae: trip.DepartEtaMae,
});

/**
 * A vessel trip that has all required fields for making predictions.
 * This is a subset of ConvexVesselTrip where prediction-critical fields are guaranteed to be present.
 */
export type PredictionReadyTrip = ConvexVesselTrip & {
  ScheduledDeparture: number;
  ArrivingTerminalAbbrev: string;
  TripStart: number;
  PrevScheduledDeparture: number;
  PrevLeftDock: number;
};

/**
 * Type for active vessel trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselTrip = ReturnType<typeof toDomainVesselTrip>;
