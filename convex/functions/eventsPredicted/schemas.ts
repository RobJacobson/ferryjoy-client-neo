/**
 * Validators and types for `eventsPredicted`: persisted table rows, trip-driven
 * projection payloads, and domain conversion helpers.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { epochMsToDate } from "../../shared/convertDates";
import { predictionTypeValidator } from "../predictions/schemas";

export const predictionSourceSchema = v.union(
  v.literal("ml"),
  v.literal("wsf_eta")
);

export type ConvexPredictionSource = Infer<typeof predictionSourceSchema>;

/**
 * Shared field validators for **persisted** prediction rows and for **each row**
 * inside a {@link predictedBoundaryProjectionEffectSchema}. Same pattern as
 * `actualBoundarySharedFields` in [`eventsActual/schemas.ts`](../eventsActual/schemas.ts).
 *
 * Unlike actual boundary patches, prediction projection already targets a
 * specific boundary, so rows carry the full `Key` (no separate segment key +
 * event type).
 */
const predictedBoundarySharedFields = {
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventPredictedTime: v.number(),
  PredictionType: predictionTypeValidator,
  PredictionSource: predictionSourceSchema,
  /** Observed time when actualized (epoch ms). */
  Actual: v.optional(v.number()),
  /** Signed error vs PredTime in minutes when actualized. */
  DeltaTotal: v.optional(v.number()),
} as const;

/**
 * Convex validator for one **persisted** `eventsPredicted` document.
 *
 * Spreads {@link predictedBoundarySharedFields}, then adds `UpdatedAt` (set at
 * insert/replace). Compared to each row in a projection effect: same payload
 * columns, plus stamping.
 */
export const eventsPredictedSchema = v.object({
  ...predictedBoundarySharedFields,
  UpdatedAt: v.number(),
});

export type ConvexPredictedBoundaryEvent = Infer<typeof eventsPredictedSchema>;

/**
 * One prediction row inside a trip-driven projection batch (before persistence).
 * Same columns as {@link predictedBoundarySharedFields}; **no** `UpdatedAt`
 * (the mutation applies a single stamp when writing).
 */
const predictedBoundaryProjectionRowSchema = v.object(
  predictedBoundarySharedFields
);

export type ConvexPredictedBoundaryProjectionRow = Infer<
  typeof predictedBoundaryProjectionRowSchema
>;

/**
 * Batch projection input: vessel/day scope, authoritative key set, replacement
 * rows. Top-level `VesselAbbrev` / `SailingDay` identify the slice; each
 * element of `Rows` repeats them per row for self-contained payloads.
 */
export const predictedBoundaryProjectionEffectSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  TargetKeys: v.array(v.string()),
  Rows: v.array(predictedBoundaryProjectionRowSchema),
});

export type ConvexPredictedBoundaryProjectionEffect = Infer<
  typeof predictedBoundaryProjectionEffectSchema
>;

/**
 * Map key / dedupe id for one `eventsPredicted` row: `Key`, prediction type,
 * and source. Keep in sync with `projectPredictedBoundaryEffects` and timeline
 * dedupe (`normalizedEvents`).
 *
 * @param row - Row identity fields only
 * @returns Single string for `Map` lookups
 */
export const predictedBoundaryCompositeKey = (row: {
  Key: string;
  PredictionType: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionType}|${row.PredictionSource}`;

/**
 * Converts a predicted boundary event into the domain shape with `Date`
 * instances.
 *
 * @param event - Predicted boundary event using epoch milliseconds
 * @returns Predicted boundary event with `Date` instances
 */
export const toDomainPredictedBoundaryEvent = (
  event: ConvexPredictedBoundaryEvent
) => ({
  ...event,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventPredictedTime: epochMsToDate(event.EventPredictedTime),
});

export type PredictedBoundaryEvent = ReturnType<
  typeof toDomainPredictedBoundaryEvent
>;
