/**
 * Convex schemas and domain conversion helpers for vessel trips.
 *
 * `ConvexVesselTrip` is the canonical stored trip row. Query/API reads can
 * enrich that row with minimal prediction fields from `eventsPredicted`, while
 * in-memory builders may still attach full ML shapes from `predictionSchema`
 * until persistence strips them.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Convex validator for full ML prediction payloads used only in memory during
 * trip building and actualization.
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
 * Full in-memory ML prediction shape. These blobs are never stored on
 * `activeVesselTrips` / `completedVesselTrips`.
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

const tripIdentityFields = {
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  RouteAbbrev: v.optional(v.string()),
  // Physical trip identity is required post-cutover. Schedule alignment may be
  // absent, but every persisted trip row must still carry its stable TripKey.
  TripKey: v.string(),
  ScheduleKey: v.optional(v.string()),
  SailingDay: v.optional(v.string()),
  PrevTerminalAbbrev: v.optional(v.string()),
  // Canonical timestamp contract. Physical boundary actuals use past-tense
  // names (`TripStart`, `TripEnd`, `LeftDockActual`).
  TripStart: v.optional(v.number()),
  TripEnd: v.optional(v.number()),
  AtDock: v.boolean(),
  AtDockDuration: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  LeftDock: v.optional(v.number()),
  LeftDockActual: v.optional(v.number()),
  TripDelay: v.optional(v.number()),
  Eta: v.optional(v.number()),
  AtSeaDuration: v.optional(v.number()),
  TotalDuration: v.optional(v.number()),
  InService: v.boolean(),
  TimeStamp: v.number(),
  PrevScheduledDeparture: v.optional(v.number()),
  PrevLeftDock: v.optional(v.number()),
  NextScheduleKey: v.optional(v.string()),
  NextScheduledDeparture: v.optional(v.number()),
} as const;

/**
 * Convex validator for rows stored in `activeVesselTrips` / `completedVesselTrips`.
 * Predictions live in `eventsPredicted`; they are not embedded on trip documents.
 */
export const vesselTripStoredSchema = v.object({
  ...tripIdentityFields,
});

/**
 * Rows stored on `activeVesselTrips` / `completedVesselTrips` (no joined ML columns).
 *
 * Canonical minimum shape for preloaded `activeTrips` in **updateVesselTrip** and the
 * orchestrator snapshot. Client queries may return `ConvexVesselTripWithPredictions`
 * (joined minimal predictions); the trips pipeline and persistence use this type only.
 *
 * Trip-field inference observability metadata such as
 * `tripFieldResolutionMethod` is intentionally excluded from this stored schema.
 */
export type ConvexVesselTrip = Infer<typeof vesselTripStoredSchema>;

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

/**
 * Public query/API vessel trip: stored fields plus minimal prediction fields
 * enriched from `eventsPredicted` (not the orchestrator tick bundle, which uses
 * storage-native `ConvexVesselTrip` rows).
 */
export type ConvexVesselTripWithPredictions = Infer<typeof vesselTripSchema>;

const predictionOrJoinedPredictionSchema = v.union(
  predictionSchema,
  joinedTripPredictionSchema
);

/**
 * In-memory trip shape with full ML blobs, used during orchestrator prediction
 * and event assembly before persistence strips embedded predictions.
 */
export const vesselTripWithMlSchema = v.object({
  ...tripIdentityFields,
  AtDockDepartCurr: v.optional(predictionOrJoinedPredictionSchema),
  AtDockArriveNext: v.optional(predictionOrJoinedPredictionSchema),
  AtDockDepartNext: v.optional(predictionOrJoinedPredictionSchema),
  AtSeaArriveNext: v.optional(predictionOrJoinedPredictionSchema),
  AtSeaDepartNext: v.optional(predictionOrJoinedPredictionSchema),
});

/**
 * In-memory vessel trip during ML build: stored fields plus optional predictions
 * (full ML output and/or query-joined minimal rows).
 */
export type ConvexVesselTripWithML = ConvexVesselTrip & {
  AtDockDepartCurr?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtDockArriveNext?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtDockDepartNext?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtSeaArriveNext?: ConvexPrediction | ConvexJoinedTripPrediction;
  AtSeaDepartNext?: ConvexPrediction | ConvexJoinedTripPrediction;
};

export type PredictionReadyTrip = ConvexVesselTripWithML & {
  ScheduledDeparture: number;
  PrevTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  TripStart: number;
  PrevScheduledDeparture: number;
  PrevLeftDock: number;
};
