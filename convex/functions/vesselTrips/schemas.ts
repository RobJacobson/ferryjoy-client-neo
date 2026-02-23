import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  scheduledTripSchema,
  toDomainScheduledTrip,
} from "functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
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
  // Model performance metrics (from training)
  MAE: v.number(), // Mean Absolute Error in minutes
  StdDev: v.number(), // Standard deviation of errors in minutes
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
  // Model performance metrics (from training)
  MAE: number; // Mean Absolute Error in minutes
  StdDev: number; // Standard deviation of errors in minutes
  // Actual observed time (optional, set when trip completes)
  Actual?: Date;
  // Signed difference: Actual - PredTime (optional, in minutes)
  DeltaTotal?: number;
  // Range deviation: (Actual - MinTime) if Actual < MinTime,
  // (Actual - MaxTime) if Actual > MaxTime, 0 if within bounds
  DeltaRange?: number;
};

/**
 * Convert Convex prediction (numbers) to domain prediction (Dates).
 * Transforms timestamp fields from epoch milliseconds to Date objects for domain layer use.
 *
 * @param prediction - Convex prediction record with numeric timestamps
 * @returns Domain prediction with Date objects for all timestamp fields
 */
export const toDomainPrediction = (
  prediction: ConvexPrediction
): Prediction => ({
  PredTime: epochMsToDate(prediction.PredTime),
  MinTime: epochMsToDate(prediction.MinTime),
  MaxTime: epochMsToDate(prediction.MaxTime),
  MAE: prediction.MAE,
  StdDev: prediction.StdDev,
  Actual: optionalEpochMsToDate(prediction.Actual),
  DeltaTotal: prediction.DeltaTotal,
  DeltaRange: prediction.DeltaRange,
});

/**
 * Convert optional Convex prediction to optional domain prediction.
 * Safely handles undefined predictions without throwing errors.
 *
 * @param prediction - Optional Convex prediction record with numeric timestamps
 * @returns Optional domain prediction with Date objects, or undefined if input is undefined
 */
export const optionalToDomainPrediction = (
  prediction?: ConvexPrediction
): Prediction | undefined =>
  prediction ? toDomainPrediction(prediction) : undefined;

/**
 * Convex validator for vessel trips (numbers)
 * Vessel trip records enriched with optional ScheduledTrip snapshot data.
 */
export const vesselTripSchema = v.object({
  // Core trip identity fields (from vessel locations)
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  Key: v.optional(v.string()), // Optional given need for departing terminal
  SailingDay: v.string(), // WSF operational day in YYYY-MM-DD format
  ScheduledTrip: v.optional(scheduledTripSchema),
  // Additional VesselTrip-specific fields
  PrevTerminalAbbrev: v.optional(v.string()),
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
 * Inferred from the Convex validator.
 */
export type ConvexVesselTrip = Infer<typeof vesselTripSchema>;

/**
 * Converts vessel location to trip format with simplified schema.
 * Note: location is already in Convex format (numbers), returns Convex format.
 * Used to transform vessel location data into vessel trip records for tracking and predictions.
 *
 * @param cvl - Convex vessel location record to convert
 * @param params - Additional trip parameters including predictions and previous trip data
 * @returns Complete vessel trip record in Convex format ready for database storage
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
  return {
    // Core trip identity fields (from vessel locations)
    VesselAbbrev: cvl.VesselAbbrev,
    DepartingTerminalAbbrev: cvl.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: cvl.ArrivingTerminalAbbrev,
    SailingDay: "", // Not available in vessel location data
    ScheduledTrip: undefined,
    // VesselTrip-specific fields
    PrevTerminalAbbrev: params.PrevTerminalAbbrev,
    TripStart: params.TripStart,
    AtDock: cvl.AtDock,
    ScheduledDeparture: cvl.ScheduledDeparture,
    LeftDock: cvl.LeftDock,
    TripDelay: undefined,
    Eta: cvl.Eta,
    TripEnd: params.TripEnd,
    InService: cvl.InService,
    TimeStamp: cvl.TimeStamp,
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
 * Convert Convex vessel trip (numbers) to domain vessel trip (Dates).
 * Manual conversion from epoch milliseconds to Date objects.
 *
 * @param trip - Convex vessel trip with numeric timestamps
 * @returns Domain vessel trip with Date objects and resolved predictions
 */
export const toDomainVesselTrip = (trip: ConvexVesselTrip): VesselTrip => {
  const domainTrip = {
    ...trip,
    ScheduledTrip: trip.ScheduledTrip
      ? toDomainScheduledTrip(trip.ScheduledTrip)
      : undefined,
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
  };

  return domainTrip;
};

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
export type VesselTrip = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev?: string;
  Key?: string;
  SailingDay: string;
  ScheduledTrip?: ReturnType<typeof toDomainScheduledTrip>;
  PrevTerminalAbbrev?: string;
  TripStart?: Date;
  AtDock: boolean;
  AtDockDuration?: number;
  ScheduledDeparture?: Date;
  LeftDock?: Date;
  TripDelay?: number;
  Eta?: Date;
  TripEnd?: Date;
  AtSeaDuration?: number;
  TotalDuration?: number;
  InService: boolean;
  TimeStamp: Date;
  PrevScheduledDeparture?: number;
  PrevLeftDock?: number;
  // ML model predictions (raw, no backend resolution)
  AtDockDepartCurr?: Prediction;
  AtDockArriveNext?: Prediction;
  AtDockDepartNext?: Prediction;
  AtSeaArriveNext?: Prediction;
  AtSeaDepartNext?: Prediction;
};
