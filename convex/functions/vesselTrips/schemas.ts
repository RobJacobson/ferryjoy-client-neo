/**
 * Convex schemas and domain conversion helpers for vessel trips.
 *
 * Persisted trips omit ML blobs; predictions are joined from `eventsPredicted`
 * for API responses. In-memory builders still attach full ML shapes from
 * `predictionSchema` until persistence strips them.
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
 * Convex validator for full ML prediction payloads (in-memory / model output).
 */
export const predictionSchema = v.object({
  PredTime: v.number(),
  MinTime: v.number(),
  MaxTime: v.number(),
  MAE: v.number(),
  StdDev: v.number(),
  Actual: v.optional(v.number()),
  DeltaTotal: v.optional(v.number()),
  DeltaRange: v.optional(v.number()),
});

/**
 * Stored prediction shape in Convex (full ML blob).
 */
export type ConvexPrediction = Infer<typeof predictionSchema>;

/**
 * Minimal prediction shape returned from queries (joined from `eventsPredicted`).
 */
export const joinedTripPredictionSchema = v.object({
  PredTime: v.number(),
  Actual: v.optional(v.number()),
  DeltaTotal: v.optional(v.number()),
});

export type ConvexJoinedTripPrediction = Infer<
  typeof joinedTripPredictionSchema
>;

/**
 * Domain-layer prediction shape with `Date` instances (full ML).
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
 * Domain prediction for wire/joined minimal payloads.
 */
export type JoinedPrediction = {
  PredTime: Date;
  Actual?: Date;
  DeltaTotal?: number;
};

/**
 * Convert Convex prediction (numbers) to domain prediction (Dates).
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
 * Convert joined query prediction to domain shape.
 *
 * @param prediction - Minimal joined prediction
 * @returns Domain joined prediction
 */
export const toDomainJoinedPrediction = (
  prediction: ConvexJoinedTripPrediction
): JoinedPrediction => ({
  PredTime: epochMsToDate(prediction.PredTime),
  Actual: optionalEpochMsToDate(prediction.Actual),
  DeltaTotal: prediction.DeltaTotal,
});

/**
 * Convert optional Convex prediction to optional domain prediction.
 *
 * @param prediction - Optional Convex prediction record with numeric timestamps
 * @returns Optional domain prediction with Date objects, or undefined if input is undefined
 */
export const optionalToDomainPrediction = (
  prediction?: ConvexPrediction
): Prediction | undefined =>
  prediction ? toDomainPrediction(prediction) : undefined;

/**
 * Convert optional joined prediction to optional domain joined prediction.
 *
 * @param prediction - Optional minimal prediction from queries
 * @returns Optional domain shape
 */
export const optionalToDomainJoinedPrediction = (
  prediction?: ConvexJoinedTripPrediction
): JoinedPrediction | undefined =>
  prediction ? toDomainJoinedPrediction(prediction) : undefined;

const tripIdentityFields = {
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  RouteAbbrev: v.optional(v.string()),
  Key: v.optional(v.string()),
  SailingDay: v.optional(v.string()),
  PrevTerminalAbbrev: v.optional(v.string()),
  ArriveDest: v.optional(v.number()),
  TripStart: v.optional(v.number()),
  AtDock: v.boolean(),
  AtDockDuration: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  LeftDock: v.optional(v.number()),
  TripDelay: v.optional(v.number()),
  Eta: v.optional(v.number()),
  TripEnd: v.optional(v.number()),
  AtSeaDuration: v.optional(v.number()),
  TotalDuration: v.optional(v.number()),
  InService: v.boolean(),
  TimeStamp: v.number(),
  PrevScheduledDeparture: v.optional(v.number()),
  PrevLeftDock: v.optional(v.number()),
  NextKey: v.optional(v.string()),
  NextScheduledDeparture: v.optional(v.number()),
} as const;

/**
 * Convex validator for rows stored in `activeVesselTrips` / `completedVesselTrips`.
 * Predictions live in `eventsPredicted`; they are not embedded on trip documents.
 */
export const vesselTripStoredSchema = v.object({
  ...tripIdentityFields,
});

export type ConvexVesselTripStored = Infer<typeof vesselTripStoredSchema>;

/**
 * Active trip rows as persisted on `activeVesselTrips` (no joined ML columns).
 *
 * Canonical minimum shape for preloaded `activeTrips` passed into
 * `processVesselTrips` (e.g. orchestrator bundled read). Callers may still pass
 * {@link ConvexVesselTrip} (hydrated) for transitional compatibility; lifecycle
 * compares strip predictions; projection uses normalized prediction fields when
 * present.
 */
export type TickActiveTrip = ConvexVesselTripStored;

/**
 * Full API / action shape: stored trip fields plus optional joined predictions.
 */
export const vesselTripSchema = v.object({
  ...tripIdentityFields,
  AtDockDepartCurr: v.optional(joinedTripPredictionSchema),
  AtDockArriveNext: v.optional(joinedTripPredictionSchema),
  AtDockDepartNext: v.optional(joinedTripPredictionSchema),
  AtSeaArriveNext: v.optional(joinedTripPredictionSchema),
  AtSeaDepartNext: v.optional(joinedTripPredictionSchema),
});

/** In-memory trip may carry full ML output or query-joined minimal rows. */
const tripPredictionPayloadSchema = v.union(
  predictionSchema,
  joinedTripPredictionSchema
);

/**
 * Action/mutation payloads from `buildTrip` before persistence: full ML blobs.
 */
export const vesselTripMlPayloadSchema = vesselTripStoredSchema.extend({
  AtDockDepartCurr: v.optional(tripPredictionPayloadSchema),
  AtDockArriveNext: v.optional(tripPredictionPayloadSchema),
  AtDockDepartNext: v.optional(tripPredictionPayloadSchema),
  AtSeaArriveNext: v.optional(tripPredictionPayloadSchema),
  AtSeaDepartNext: v.optional(tripPredictionPayloadSchema),
});

/**
 * Hydrated vessel trip: public queries and subscriber read paths after joining
 * `eventsPredicted` (not the orchestrator tick bundle, which uses storage-native
 * {@link TickActiveTrip} rows).
 */
export type ConvexVesselTrip = Infer<typeof vesselTripSchema>;

/**
 * In-memory vessel trip during ML build: stored fields plus optional predictions
 * (full ML output and/or query-joined minimal rows).
 */
export type ConvexVesselTripWithML = ConvexVesselTripStored & {
  AtDockDepartCurr?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtDockArriveNext?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtDockDepartNext?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtSeaArriveNext?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtSeaDepartNext?: ConvexPrediction | ConvexJoinedTripPrediction;
};

/**
 * Convert Convex vessel trip (numbers) to domain vessel trip (Dates).
 * Supports both joined minimal predictions and full ML blobs when present.
 *
 * @param trip - Convex vessel trip with numeric timestamps
 * @returns Domain vessel trip with Date objects and resolved predictions
 */
export const toDomainVesselTrip = (
  trip: ConvexVesselTrip | (ConvexVesselTripStored & Record<string, unknown>)
) => {
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
    AtDockDepartCurr: mapPredictionField(trip.AtDockDepartCurr),
    AtDockArriveNext: mapPredictionField(trip.AtDockArriveNext),
    AtDockDepartNext: mapPredictionField(trip.AtDockDepartNext),
    AtSeaArriveNext: mapPredictionField(trip.AtSeaArriveNext),
    AtSeaDepartNext: mapPredictionField(trip.AtSeaDepartNext),
  };

  return domainTrip;
};

const mapPredictionField = (
  value: unknown
): Prediction | JoinedPrediction | undefined => {
  if (value === undefined) return undefined;
  const v = value as { PredTime?: number; MinTime?: number; MAE?: number };
  if (v.MinTime !== undefined && v.MAE !== undefined) {
    return toDomainPrediction(value as ConvexPrediction);
  }
  return toDomainJoinedPrediction(value as ConvexJoinedTripPrediction);
};

/**
 * Convert Convex vessel trip with optional ScheduledTrip to domain shape.
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

export type PredictionReadyTrip = ConvexVesselTripWithML & {
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
