/**
 * Normalization and equality for ML prediction payloads used in overlay/timeline
 * semantics and for compare-then-write persistence of `vesselTripPredictions`.
 *
 * Compares only PredTime, Actual, and DeltaTotal so MAE / interval fields do not
 * force writes or overlay refreshes.
 */

import type { ConvexPrediction } from "functions/vesselTrips/schemas";
import { deepEqual } from "shared/deepEqual";

/**
 * Projects a prediction-shaped value to overlay/persist comparison fields only.
 *
 * @param value - Full ML blob, joined minimal shape, or undefined
 * @returns Plain object with only defined PredTime / Actual / DeltaTotal, or
 *   undefined when none are present
 */
export const normalizeConvexPredictionForOverlayEquality = (
  value: unknown
): unknown => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (o.PredTime !== undefined) {
    out.PredTime = o.PredTime;
  }
  if (o.Actual !== undefined) {
    out.Actual = o.Actual;
  }
  if (o.DeltaTotal !== undefined) {
    out.DeltaTotal = o.DeltaTotal;
  }
  return Object.keys(out).length === 0 ? undefined : out;
};

/**
 * True when two prediction field values match for overlay and prediction-row
 * persistence (normalized PredTime / Actual / DeltaTotal).
 *
 * @param a - First prediction-shaped value
 * @param b - Second prediction-shaped value
 */
export const overlayPredictionProjectionsEqual = (
  a: unknown,
  b: unknown
): boolean =>
  deepEqual(
    normalizeConvexPredictionForOverlayEquality(a),
    normalizeConvexPredictionForOverlayEquality(b)
  );

/**
 * Builds a full {@link ConvexPrediction} from a stored `vesselTripPredictions` row
 * shape (identity fields are ignored).
 *
 * @param row - Stored row fields including ML columns
 * @returns Convex prediction wire shape
 */
export const convexPredictionFromVesselTripPredictionRow = (row: {
  PredTime: number;
  MinTime: number;
  MaxTime: number;
  MAE: number;
  StdDev: number;
  Actual?: number;
  DeltaTotal?: number;
  DeltaRange?: number;
}): ConvexPrediction => ({
  PredTime: row.PredTime,
  MinTime: row.MinTime,
  MaxTime: row.MaxTime,
  MAE: row.MAE,
  StdDev: row.StdDev,
  Actual: row.Actual,
  DeltaTotal: row.DeltaTotal,
  DeltaRange: row.DeltaRange,
});
