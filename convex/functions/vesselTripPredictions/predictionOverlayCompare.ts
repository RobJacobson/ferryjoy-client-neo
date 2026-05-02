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
 * Strips a prediction-shaped value to overlay and compare-then-write fields only.
 *
 * Keeps `PredTime`, `Actual`, and `DeltaTotal` so MAE, `MinTime`/`MaxTime`, and
 * similar columns do not force persistence or overlay updates when the
 * user-visible time and actualization state are unchanged.
 *
 * @param value - Full ML blob, joined minimal shape, or `undefined`
 * @returns Plain object with only defined `PredTime`, `Actual`, and `DeltaTotal`,
 *   or `undefined` when none of those fields are present
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
 * Returns whether two prediction-shaped values match after overlay normalization.
 *
 * Normalizes both sides with `normalizeConvexPredictionForOverlayEquality`, then
 * compares with `deepEqual` so ordering and unrelated fields do not affect the
 * outcome.
 *
 * @param a - First prediction-shaped value
 * @param b - Second prediction-shaped value
 * @returns `true` when normalized `PredTime`, `Actual`, and `DeltaTotal` match
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
 * Builds a full `ConvexPrediction` from a stored `vesselTripPredictions` row.
 *
 * Copies ML columns only; natural keys on the table are ignored because overlay
 * comparison and timeline code consume the wire prediction shape, not row ids.
 *
 * @param row - Stored row fields including ML columns
 * @returns `ConvexPrediction` for overlay equality and timeline handoff code
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
