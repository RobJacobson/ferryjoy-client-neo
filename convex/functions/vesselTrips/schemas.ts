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
  PrevAtSeaDuration: v.optional(v.number()), // Previous trip's at-sea duration in minutes
  PrevTripDelay: v.optional(v.number()), // Previous trip's departure delay in minutes
  // Predicted departure delay (in minutes)
  TripDelayPred: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  TripDelayPredMae: v.optional(v.number()),
  // Predicted arrival time based on arrival (arrive-arrive model, absolute timestamp in milliseconds)
  EtaPredArrive: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  EtaPredArriveMae: v.optional(v.number()),
  // Predicted arrival time based on departure (depart-arrive model, absolute timestamp in milliseconds)
  EtaPredDepart: v.optional(v.number()),
  // Prediction MAE (rounded to nearest 0.01 minute)
  EtaPredDepartMae: v.optional(v.number()),
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
    TripDelay?: number;
    // Denormalized previous trip data
    PrevAtSeaDuration?: number;
    PrevTripDelay?: number;
    // Prediction fields
    TripDelayPred?: number;
    TripDelayPredMae?: number;
    EtaPredArrive?: number;
    EtaPredArriveMae?: number;
    EtaPredDepart?: number;
    EtaPredDepartMae?: number;
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
  TripDelay: params.TripDelay,
  InService: cvl.InService,
  // Denormalized previous trip data
  PrevAtSeaDuration: params.PrevAtSeaDuration,
  PrevTripDelay: params.PrevTripDelay,
  // Prediction fields
  TripDelayPred: params.TripDelayPred,
  TripDelayPredMae: params.TripDelayPredMae,
  EtaPredArrive: params.EtaPredArrive,
  EtaPredArriveMae: params.EtaPredArriveMae,
  EtaPredDepart: params.EtaPredDepart,
  EtaPredDepartMae: params.EtaPredDepartMae,
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
  EtaPredArrive: optionalEpochMsToDate(trip.EtaPredArrive), // ETA is still a timestamp
  EtaPredDepart: optionalEpochMsToDate(trip.EtaPredDepart), // ETA is still a timestamp
  // MAE fields remain as numbers (not timestamps)
  TripDelayPredMae: trip.TripDelayPredMae,
  EtaPredArriveMae: trip.EtaPredArriveMae,
  EtaPredDepartMae: trip.EtaPredDepartMae,
});

/**
 * A vessel trip that has all required fields for making predictions.
 * This is a subset of ConvexVesselTrip where prediction-critical fields are guaranteed to be present.
 */
export type PredictionReadyTrip = ConvexVesselTrip & {
  ScheduledDeparture: number;
  ArrivingTerminalAbbrev: string;
  TripStart: number;
  PrevTripDelay: number;
  PrevAtSeaDuration: number;
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
  trip.PrevTripDelay !== undefined &&
  trip.PrevAtSeaDuration !== undefined;

/**
 * Type for active vessel trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselTrip = ReturnType<typeof toDomainVesselTrip>;
