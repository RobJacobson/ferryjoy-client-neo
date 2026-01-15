import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { generateTripKey } from "shared";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

/**
 * Convex validator for ML prediction data (numbers)
 * Contains prediction results with uncertainty bounds and actual outcomes
 */
export const predictionSchema = v.object({
  // Our actual predicted time (milliseconds since epoch)
  PredTime: v.number(),
  // Lower bound for time prediction (PredTime - 1 Std Dev)
  MinTime: v.number(),
  // Upper bound for time prediction (PredTime + 1 Std Dev)
  MaxTime: v.number(),
  // Actual observed time (optional, set when trip completes)
  Actual: v.optional(v.number()),
  // Signed difference: Actual - PredTime (optional, in minutes)
  DeltaTotal: v.optional(v.number()),
  // Range deviation: (Actual - MinTime) if Actual < MinTime,
  // (Actual - MaxTime) if Actual > MinTime, 0 if within bounds
  DeltaRange: v.optional(v.number()),
});

/**
 * Type for prediction data in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexPrediction = Infer<typeof predictionSchema>;

/**
 * Type for prediction data in domain layer (with Date objects)
 */
export type Prediction = {
  // Our actual predicted time
  PredTime: Date;
  // Lower bound for time prediction (PredTime - 1 Std Dev)
  MinTime: Date;
  // Upper bound for time prediction (PredTime + 1 Std Dev)
  MaxTime: Date;
  // Actual observed time (optional, set when trip completes)
  Actual?: Date;
  // Signed difference: Actual - PredTime (optional, in minutes)
  DeltaTotal?: number;
  // Range deviation: (Actual - MinTime) if Actual < MinTime,
  // (Actual - MaxTime) if Actual > MaxTime, 0 if within bounds
  DeltaRange?: number;
};

/**
 * Convert Convex prediction (numbers) to domain prediction (Dates)
 */
export const toDomainPrediction = (
  prediction: ConvexPrediction
): Prediction => ({
  PredTime: epochMsToDate(prediction.PredTime),
  MinTime: epochMsToDate(prediction.MinTime),
  MaxTime: epochMsToDate(prediction.MaxTime),
  Actual: optionalEpochMsToDate(prediction.Actual),
  DeltaTotal: prediction.DeltaTotal,
  DeltaRange: prediction.DeltaRange,
});

/**
 * Convert optional Convex prediction to optional domain prediction
 */
export const optionalToDomainPrediction = (
  prediction?: ConvexPrediction
): Prediction | undefined =>
  prediction ? toDomainPrediction(prediction) : undefined;

/**
 * Convex validator for vessel trips (numbers)
 * Simplified schema without Status field - table determines status
 */
export const vesselTripSchema = v.object({
  Key: v.optional(v.string()), // Composite key for trip identification
  VesselAbbrev: v.string(),
  PrevTerminalAbbrev: v.optional(v.string()),
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
  // ML model predictions with uncertainty bounds and actual outcomes
  AtDockDepartCurr: v.optional(predictionSchema), // at-dock-depart-curr model
  AtDockArriveNext: v.optional(predictionSchema), // at-dock-arrive-next model
  AtDockDepartNext: v.optional(predictionSchema), // at-dock-depart-next model
  AtSeaArriveNext: v.optional(predictionSchema), // at-sea-arrive-next model
  AtSeaDepartNext: v.optional(predictionSchema), // at-sea-depart-next model
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
    PrevTerminalAbbrev?: string;
    PrevScheduledDeparture?: number;
    PrevLeftDock?: number;
    // ML model predictions
    AtDockDepartCurr?: ConvexPrediction;
    AtDockArriveNext?: ConvexPrediction;
    AtDockDepartNext?: ConvexPrediction;
    AtSeaArriveNext?: ConvexPrediction;
    AtSeaDepartNext?: ConvexPrediction;
  }
): ConvexVesselTrip => {
  // Generate key if we have the required information
  const key = generateTripKey(
    cvl.VesselAbbrev,
    cvl.DepartingTerminalAbbrev,
    cvl.ArrivingTerminalAbbrev,
    cvl.ScheduledDeparture ? new Date(cvl.ScheduledDeparture) : undefined
  );

  return {
    Key: key,
    VesselAbbrev: cvl.VesselAbbrev,
    PrevTerminalAbbrev: params.PrevTerminalAbbrev,
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
    // ML model predictions
    AtDockDepartCurr: params.AtDockDepartCurr,
    AtDockArriveNext: params.AtDockArriveNext,
    AtDockDepartNext: params.AtDockDepartNext,
    AtSeaArriveNext: params.AtSeaArriveNext,
    AtSeaDepartNext: params.AtSeaDepartNext,
  };
};

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
  // ML model predictions
  AtDockDepartCurr: optionalToDomainPrediction(trip.AtDockDepartCurr),
  AtDockArriveNext: optionalToDomainPrediction(trip.AtDockArriveNext),
  AtDockDepartNext: optionalToDomainPrediction(trip.AtDockDepartNext),
  AtSeaArriveNext: optionalToDomainPrediction(trip.AtSeaArriveNext),
  AtSeaDepartNext: optionalToDomainPrediction(trip.AtSeaDepartNext),
});

/**
 * A vessel trip that has all required fields for making predictions.
 * This is a subset of ConvexVesselTrip where prediction-critical fields are guaranteed to be present.
 */
export type PredictionReadyTrip = ConvexVesselTrip & {
  ScheduledDeparture: number;
  PrevTerminalAbbrev: string;
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
