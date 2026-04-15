/**
 * Pure policy for backfilling depart-next prediction actuals on `eventsPredicted`.
 */

import { buildBoundaryKey } from "shared/keys";

/** ML prediction types updated on leave-dock for the next leg departure boundary. */
export const DEPART_NEXT_ML_PREDICTION_TYPES = [
  "AtDockDepartNext",
  "AtSeaDepartNext",
] as const;

/**
 * Round actual depart time to whole seconds for prediction row consistency.
 *
 * @param epochMs - Wall-clock ms from the feed
 * @returns Epoch ms floored to seconds
 */
export const normalizeDepartActualMs = (epochMs: number): number =>
  Math.floor(epochMs / 1000) * 1000;

/**
 * Boundary key for the next leg's dep-dock prediction rows.
 *
 * @param nextScheduleKey - Next segment key from the completed trip row
 * @returns dep-dock boundary key for `eventsPredicted` lookup
 */
export const buildDepartNextDepDockBoundaryKey = (
  nextScheduleKey: string
): string => buildBoundaryKey(nextScheduleKey, "dep-dock");

export type DepartNextLegContext =
  | { ok: false; reason: "no_next_leg_context" }
  | { ok: true; depKey: string; actualMs: number };

/**
 * Validates completed-trip context needed to actualize depart-next predictions.
 *
 * @param completed - Most recent completed trip row
 * @param actualDepartMs - Actual departure ms for the next leg (feed time)
 */
export const resolveDepartNextLegContext = (
  completed: {
    NextScheduleKey?: string;
    SailingDay?: string;
  },
  actualDepartMs: number
): DepartNextLegContext => {
  const nextLegKey = completed.NextScheduleKey;
  if (!nextLegKey || !completed.SailingDay) {
    return { ok: false, reason: "no_next_leg_context" };
  }
  return {
    ok: true,
    depKey: buildDepartNextDepDockBoundaryKey(nextLegKey),
    actualMs: normalizeDepartActualMs(actualDepartMs),
  };
};
