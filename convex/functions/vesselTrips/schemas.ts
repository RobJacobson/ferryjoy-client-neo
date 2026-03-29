/**
 * Convex schemas and domain conversion helpers for vessel trips.
 *
 * Defines the persisted trip and prediction shapes and converts epoch-based
 * Convex records into the `Date`-based domain objects used elsewhere.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import { toDomainScheduledTrip } from "functions/scheduledTrips/schemas";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

/**
 * Convex validator for vessel-trip prediction payloads.
 */
export const predictionSchema = v.object({
  // Predicted timestamp window plus model accuracy metadata.
  PredTime: v.number(),
  MinTime: v.number(),
  MaxTime: v.number(),
  MAE: v.number(),
  StdDev: v.number(),
  // Actuals are backfilled after the predicted event is observed.
  Actual: v.optional(v.number()),
  DeltaTotal: v.optional(v.number()),
  // DeltaRange stays 0 when the actual lands inside the predicted interval.
  DeltaRange: v.optional(v.number()),
});

/**
 * Stored prediction shape in Convex.
 */
export type ConvexPrediction = Infer<typeof predictionSchema>;

/**
 * Domain-layer prediction shape with `Date` instances.
 */
export type Prediction = {
  PredTime: Date;
  MinTime: Date;
  MaxTime: Date;
  MAE: number;
  StdDev: number;
  Actual?: Date;
  DeltaTotal?: number;
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
 * Convex validator for persisted vessel-trip records.
 */
export const vesselTripSchema = v.object({
  // Trip identity and schedule-join fields.
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  RouteAbbrev: v.optional(v.string()),
  Key: v.optional(v.string()),
  SailingDay: v.optional(v.string()),
  // Lifecycle timestamps and derived durations.
  PrevTerminalAbbrev: v.optional(v.string()),
  ArriveDest: v.optional(v.number()),
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
  // Previous and next-leg schedule context used by prediction models.
  PrevScheduledDeparture: v.optional(v.number()),
  PrevLeftDock: v.optional(v.number()),
  NextKey: v.optional(v.string()),
  NextScheduledDeparture: v.optional(v.number()),
  // Prediction outputs for current-leg and next-leg boundary events.
  AtDockDepartCurr: v.optional(predictionSchema),
  AtDockArriveNext: v.optional(predictionSchema),
  AtDockDepartNext: v.optional(predictionSchema),
  AtSeaArriveNext: v.optional(predictionSchema),
  AtSeaDepartNext: v.optional(predictionSchema),
});

/**
 * Stored vessel-trip shape in Convex.
 */
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
    NextScheduledDeparture: optionalEpochMsToDate(trip.NextScheduledDeparture),
    Eta: optionalEpochMsToDate(trip.Eta),
    LeftDock: optionalEpochMsToDate(trip.LeftDock),
    TimeStamp: epochMsToDate(trip.TimeStamp),
    ArriveDest: optionalEpochMsToDate(trip.ArriveDest),
    TripStart: optionalEpochMsToDate(trip.TripStart),
    TripEnd: optionalEpochMsToDate(trip.TripEnd),
    // Nested prediction payloads are converted after copying scalar fields.
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
 * Domain-layer vessel trip shape with `Date` instances.
 */
export type VesselTrip = ReturnType<typeof toDomainVesselTrip>;

/**
 * Vessel trip with optional joined ScheduledTrip (from getActiveTripsWithScheduled).
 */
export type VesselTripWithScheduledTrip = ReturnType<
  typeof toDomainVesselTripWithScheduledTrip
>;
