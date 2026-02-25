import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import { toDomainScheduledTrip } from "functions/scheduledTrips/schemas";
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
 * Vessel trip records with optional reference to ScheduledTrip document.
 */
export const vesselTripSchema = v.object({
  // Core trip identity fields (from vessel locations)
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  RouteAbbrev: v.optional(v.string()),
  Key: v.optional(v.string()), // Optional given need for departing terminal
  SailingDay: v.optional(v.string()), // WSF operational day in YYYY-MM-DD format
  scheduledTripId: v.optional(v.id("scheduledTrips")),
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

export type ConvexVesselTrip = Infer<typeof vesselTripSchema>;

/**
 * Convert Convex vessel trip (numbers) to domain vessel trip (Dates).
 * Manual conversion from epoch milliseconds to Date objects.
 *
 * @param trip - Convex vessel trip with numeric timestamps
 * @returns Domain vessel trip with Date objects and resolved predictions
 */
export const toDomainVesselTrip = (trip: ConvexVesselTrip) => {
  const domainTrip = {
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
  };

  return domainTrip;
};

/**
 * Convert Convex vessel trip with optional ScheduledTrip to domain shape.
 * Use when query returns joined ScheduledTrip (e.g. getActiveTripsWithScheduled).
 *
 * @param trip - Convex vessel trip with optional ScheduledTrip
 * @returns Domain vessel trip with Date objects and optional domain ScheduledTrip
 */
export const toDomainVesselTripWithScheduledTrip = (
  trip: ConvexVesselTrip & { ScheduledTrip?: ConvexScheduledTrip }
) => {
  const domainTrip = toDomainVesselTrip(trip);
  const ScheduledTrip = trip.ScheduledTrip
    ? toDomainScheduledTrip(trip.ScheduledTrip)
    : undefined;
  return { ...domainTrip, ScheduledTrip };
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
 * Inferred from return type of our conversion function
 */
export type VesselTrip = ReturnType<typeof toDomainVesselTrip>;

/**
 * Vessel trip with optional joined ScheduledTrip (from getActiveTripsWithScheduled).
 */
export type VesselTripWithScheduledTrip = ReturnType<
  typeof toDomainVesselTripWithScheduledTrip
>;
