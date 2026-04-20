/**
 * Lifecycle trip equality for write suppression inside **updateVesselTrips**.
 *
 * Compares persisted-column shapes only: optional prediction keys that may appear
 * on in-memory test fixtures are ignored (they are not written with trip rows).
 * Timeline / `eventsPredicted` refresh driven by ML belongs to
 * **updateVesselPredictions** + **updateTimeline**, not to overlay-specific
 * inequality inside this module — so storage and overlay flags match.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deepEqual } from "shared/deepEqual";

const PREDICTION_FIELD_NAMES = [
  "AtDockDepartCurr",
  "AtDockArriveNext",
  "AtDockDepartNext",
  "AtSeaArriveNext",
  "AtSeaDepartNext",
] as const;

/** Top-level trip keys ignored when comparing for write suppression. */
const IGNORED_TRIP_KEYS = new Set<string>(["TimeStamp"]);

const stripOptionalPredictionKeys = (
  trip: Record<string, unknown>
): Record<string, unknown> => {
  const out = { ...trip };
  for (const k of PREDICTION_FIELD_NAMES) {
    delete out[k];
  }
  return out;
};

/**
 * Deep equality on stored trip shape: optional prediction blobs ignored,
 * `TimeStamp` ignored.
 */
const lifecycleTripsEqual = (
  existing: ConvexVesselTrip,
  proposed: ConvexVesselTrip
): boolean => {
  const e = stripOptionalPredictionKeys(
    existing as unknown as Record<string, unknown>
  );
  const p = stripOptionalPredictionKeys(
    proposed as unknown as Record<string, unknown>
  );
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
 * True when the persisted-row view of `proposed` matches `existing`.
 *
 * Returns false when `existing` is undefined (no baseline row to match).
 */
export const tripsEqualForStorage = (
  existing: ConvexVesselTrip | undefined,
  proposed: ConvexVesselTrip
): boolean => existing !== undefined && lifecycleTripsEqual(existing, proposed);

/**
 * Same predicate as {@link tripsEqualForStorage} on the orchestrator path: ML and
 * predicted-event refresh are handled after trip persistence.
 */
export const tripsEqualForOverlay = (
  existing: ConvexVesselTrip | undefined,
  proposed: ConvexVesselTrip
): boolean => tripsEqualForStorage(existing, proposed);

/**
 * Storage vs overlay inequality — flags coincide because trip lifecycle no longer
 * branches on prediction-only overlay deltas (see module doc).
 */
export const tripWriteSuppressionFlags = (
  existing: ConvexVesselTrip | undefined,
  proposed: ConvexVesselTrip
): { needsStorageUpsert: boolean; needsOverlayRefresh: boolean } => {
  const equal = tripsEqualForStorage(existing, proposed);
  return {
    needsStorageUpsert: !equal,
    needsOverlayRefresh: !equal,
  };
};
