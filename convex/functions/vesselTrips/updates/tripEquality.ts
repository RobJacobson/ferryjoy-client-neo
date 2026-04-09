/**
 * Shared utility helpers for vessel-trip updates.
 *
 * **Lifecycle** (`lifecycleTripsEqual`, `shouldPersistLifecycleTrip`) mirrors
 * `stripTripPredictionsForStorage`: only persisted `activeVesselTrips` columns
 * participate; `TimeStamp` is ignored.
 *
 * **Projection** (`tripsAreEqual`, `shouldRefreshTimelineProjection`) uses
 * normalized prediction fields (`PredTime` / `Actual` / `DeltaTotal`) so
 * overlay refresh can run when joined prediction semantics change without a
 * stored-row write.
 */

import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { stripTripPredictionsForStorage } from "functions/vesselTrips/stripTripForStorage";

const PREDICTION_FIELD_NAMES = [
  "AtDockDepartCurr",
  "AtDockArriveNext",
  "AtDockDepartNext",
  "AtSeaArriveNext",
  "AtSeaDepartNext",
] as const;

/**
 * Compares only persisted/joined semantics: PredTime, Actual, DeltaTotal.
 * Ignores ML-only fields (MAE, intervals) on in-memory proposals.
 */
const normalizePredictionForEquality = (value: unknown): unknown => {
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

const isPredictionFieldName = (key: string): boolean =>
  (PREDICTION_FIELD_NAMES as readonly string[]).includes(key);

/** Top-level trip keys ignored when comparing for write suppression. */
const IGNORED_TRIP_KEYS = new Set<string>(["TimeStamp"]);

/**
 * Deep equality on stored trip shape: ML prediction blobs stripped, `TimeStamp`
 * ignored. Used to decide whether `activeVesselTrips` needs an upsert this tick.
 *
 * @param existing - Existing trip (possibly hydrated; stripped before compare)
 * @param proposed - Built trip for this tick
 * @returns true when persisted columns would be unchanged
 */
export const lifecycleTripsEqual = (
  existing: ConvexVesselTrip,
  proposed: ConvexVesselTrip | ConvexVesselTripWithML
): boolean => {
  const e = stripTripPredictionsForStorage(
    existing as ConvexVesselTripWithML
  ) as Record<string, unknown>;
  const p = stripTripPredictionsForStorage(
    proposed as ConvexVesselTripWithML
  ) as Record<string, unknown>;
  const keys = new Set([...Object.keys(e), ...Object.keys(p)]);

  for (const key of keys) {
    if (IGNORED_TRIP_KEYS.has(key)) {
      continue;
    }
    if (!deepEqual(e[key], p[key])) {
      return false;
    }
  }
  return true;
};

/**
 * Returns true when the active trip row should be upserted this tick.
 *
 * New vessels always persist; otherwise compares strip-equivalent stored fields
 * (not the five ML prediction columns).
 *
 * @param existingTrip - Previously persisted active trip, if one exists
 * @param proposed - Newly built trip state for this tick
 */
export const shouldPersistLifecycleTrip = (
  existingTrip: ConvexVesselTrip | undefined,
  proposed: ConvexVesselTrip | ConvexVesselTripWithML
): boolean =>
  existingTrip === undefined
    ? true
    : !lifecycleTripsEqual(existingTrip, proposed);

/**
 * Deep equality for ConvexVesselTrip objects, excluding TimeStamp.
 *
 * Walks the union of keys on both trips so adds/removes on either side are
 * detected. Skips keys in `IGNORED_TRIP_KEYS` (currently `TimeStamp`).
 * Prediction fields compare after normalizing to PredTime / Actual / DeltaTotal
 * so ML-only noise does not force writes.
 *
 * @param existing - Existing trip from database
 * @param proposed - Newly constructed trip
 * @returns true if all compared fields are deeply equal
 */
export const tripsAreEqual = (
  existing: ConvexVesselTrip,
  proposed: ConvexVesselTrip | ConvexVesselTripWithML
): boolean => {
  const e = existing as Record<string, unknown>;
  const p = proposed as Record<string, unknown>;
  const keys = new Set([...Object.keys(e), ...Object.keys(p)]);

  for (const key of keys) {
    if (IGNORED_TRIP_KEYS.has(key)) {
      continue;
    }
    const ev = e[key];
    const pv = p[key];
    if (isPredictionFieldName(key)) {
      if (
        !deepEqual(
          normalizePredictionForEquality(ev),
          normalizePredictionForEquality(pv)
        )
      ) {
        return false;
      }
      continue;
    }
    if (!deepEqual(ev, pv)) {
      return false;
    }
  }
  return true;
};

/**
 * Returns true when timeline overlays may need refresh this tick.
 *
 * Uses normalized prediction comparison (PredTime / Actual / DeltaTotal) so
 * ML-only noise does not force projection; differs from lifecycle when only
 * joined prediction semantics change without stored-column churn.
 *
 * @param existingTrip - Previously persisted active trip, if one exists
 * @param proposed - Newly built trip state for this tick
 */
export const shouldRefreshTimelineProjection = (
  existingTrip: ConvexVesselTrip | undefined,
  proposed: ConvexVesselTrip | ConvexVesselTripWithML
): boolean =>
  existingTrip === undefined ? true : !tripsAreEqual(existingTrip, proposed);

/**
 * Deep equality check for arbitrary values.
 *
 * Handles primitives, arrays, objects, undefined, and null. undefined === undefined
 * returns true. undefined vs null returns false.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (a == null || b == null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
};
