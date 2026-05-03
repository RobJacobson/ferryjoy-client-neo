/**
 * Validators for `vesselTripPredictions`: per-slot ML payloads keyed by vessel,
 * physical trip (`TripKey`), and prediction field. Distinct from
 * `functions/predictions/` model-parameter tables.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { predictionTypeValidator } from "functions/predictions/schemas";
import { predictionSchema } from "functions/vesselTrips/schemas";

/**
 * One proposed ML snapshot for upsert (compare-then-write).
 */
export const vesselTripPredictionProposalSchema = v.object({
  VesselAbbrev: v.string(),
  TripKey: v.string(),
  PredictionType: predictionTypeValidator,
  prediction: predictionSchema,
});

export type VesselTripPredictionProposal = Infer<
  typeof vesselTripPredictionProposalSchema
>;

/**
 * Convex validator for rows stored in `vesselTripPredictions` (mirrors
 * `predictionSchema` plus keys and `UpdatedAt`).
 */
export const vesselTripPredictionStoredSchema = v.object({
  VesselAbbrev: v.string(),
  TripKey: v.string(),
  PredictionType: predictionTypeValidator,
  PredTime: v.number(),
  MinTime: v.number(),
  MaxTime: v.number(),
  MAE: v.number(),
  StdDev: v.number(),
  Actual: v.optional(v.number()),
  DeltaTotal: v.optional(v.number()),
  DeltaRange: v.optional(v.number()),
  UpdatedAt: v.number(),
});

export type VesselTripPredictionStored = Infer<
  typeof vesselTripPredictionStoredSchema
>;

/**
 * Validator for a full `vesselTripPredictions` document (query results).
 */
export const vesselTripPredictionDocSchema = v.object({
  _id: v.id("vesselTripPredictions"),
  _creationTime: v.number(),
  VesselAbbrev: v.string(),
  TripKey: v.string(),
  PredictionType: predictionTypeValidator,
  PredTime: v.number(),
  MinTime: v.number(),
  MaxTime: v.number(),
  MAE: v.number(),
  StdDev: v.number(),
  Actual: v.optional(v.number()),
  DeltaTotal: v.optional(v.number()),
  DeltaRange: v.optional(v.number()),
  UpdatedAt: v.number(),
});

export type VesselTripPredictionDoc = Infer<
  typeof vesselTripPredictionDocSchema
>;
