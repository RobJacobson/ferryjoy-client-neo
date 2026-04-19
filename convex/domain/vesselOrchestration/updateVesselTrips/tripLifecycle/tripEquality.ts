/**
 * Lifecycle vs projection trip equality for write suppression.
 *
 * **Public:** `tripsEqualForStorage` (strip-shaped persisted columns) and
 * `tripsEqualForOverlay` (normalized prediction fields for timeline overlays).
 * Prefer **`tripWriteSuppressionFlags`** when both decisions are needed in one
 * call site so storage vs overlay stay paired (same underlying compares).
 *
 * **Mirror / legacy pairs** (see `architecture.md` §9): e.g. `LeftDock` vs
 * `LeftDockActual` — strip and equality paths follow **canonical persisted
 * columns**; do not treat mirrors as interchangeable without reading call sites.
 *
 * When `existing` is undefined, both equalities return false (no baseline row).
 * Callers that need “should we upsert / refresh?” use `!tripsEqualForStorage` /
 * `!tripsEqualForOverlay`, or `tripWriteSuppressionFlags`.
 */

import {
  overlayPredictionProjectionsEqual,
  stripTripPredictionsForStorage,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type {
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";

const PREDICTION_FIELD_NAMES = [
  "AtDockDepartCurr",
  "AtDockArriveNext",
  "AtDockDepartNext",
  "AtSeaArriveNext",
  "AtSeaDepartNext",
] as const;

const isPredictionFieldName = (key: string): boolean =>
  (PREDICTION_FIELD_NAMES as readonly string[]).includes(key);

/** Top-level trip keys ignored when comparing for write suppression. */
const IGNORED_TRIP_KEYS = new Set<string>(["TimeStamp"]);

/**
 * Deep equality on stored trip shape: ML prediction blobs stripped, `TimeStamp`
 * ignored. Used to decide whether `activeVesselTrips` needs an upsert this tick.
 *
 * @param existing - Existing trip (possibly enriched with predictions; stripped
 *   before compare)
 * @param proposed - Built trip for this tick
 * @returns true when persisted columns would be unchanged
 */
const lifecycleTripsEqual = (
  existing: ConvexVesselTripWithPredictions,
  proposed: ConvexVesselTripWithPredictions | ConvexVesselTripWithML
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
 * True when the persisted-row (strip-shaped) view of `proposed` matches `existing`.
 *
 * Returns false when `existing` is undefined (no stored row to match).
 *
 * @param existing - Previously persisted active trip, if any
 * @param proposed - Newly built trip state for this tick
 */
export const tripsEqualForStorage = (
  existing: ConvexVesselTripWithPredictions | undefined,
  proposed: ConvexVesselTripWithPredictions | ConvexVesselTripWithML
): boolean => existing !== undefined && lifecycleTripsEqual(existing, proposed);

/**
 * Deep equality for timeline overlay semantics (eventsActual / eventsPredicted),
 * excluding `TimeStamp`. Prediction fields normalize to PredTime / Actual /
 * DeltaTotal so ML-only noise does not force refresh.
 *
 * @param existing - Existing trip from database
 * @param proposed - Newly constructed trip
 * @returns true if overlay-relevant fields are deeply equal
 */
const overlayTripsEqual = (
  existing: ConvexVesselTripWithPredictions,
  proposed: ConvexVesselTripWithPredictions | ConvexVesselTripWithML
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
      if (!overlayPredictionProjectionsEqual(ev, pv)) {
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
 * True when the overlay-relevant view of `proposed` matches `existing`
 * (normalized prediction fields).
 *
 * Returns false when `existing` is undefined (no baseline for overlay diff).
 *
 * @param existing - Previously persisted active trip, if any
 * @param proposed - Newly built trip state for this tick
 */
export const tripsEqualForOverlay = (
  existing: ConvexVesselTripWithPredictions | undefined,
  proposed: ConvexVesselTripWithPredictions | ConvexVesselTripWithML
): boolean => existing !== undefined && overlayTripsEqual(existing, proposed);

/**
 * Storage vs overlay inequality in one place — delegates to
 * `tripsEqualForStorage` / `tripsEqualForOverlay` so lifecycle code does not
 * duplicate the pair.
 *
 * @param existing - Previously persisted active trip, if any
 * @param proposed - Newly built trip state for this tick
 */
export const tripWriteSuppressionFlags = (
  existing: ConvexVesselTripWithPredictions | undefined,
  proposed: ConvexVesselTripWithPredictions | ConvexVesselTripWithML
): { needsStorageUpsert: boolean; needsOverlayRefresh: boolean } => ({
  needsStorageUpsert: !tripsEqualForStorage(existing, proposed),
  needsOverlayRefresh: !tripsEqualForOverlay(existing, proposed),
});

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
const deepEqual = (a: unknown, b: unknown): boolean => {
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
