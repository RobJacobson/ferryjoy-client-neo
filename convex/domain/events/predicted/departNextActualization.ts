/**
 * Pure policy for backfilling depart-next prediction actuals on eventsPredicted.
 *
 * When a vessel completes a leg, measured departure time can actualize ML predictions
 * attached to the following segments dep-dock boundary without waiting for another ML tick.
 */

import { buildBoundaryKey } from "shared/keys";
import { floorToSecond } from "shared/time";

/**
 * ML prediction kinds refreshed when leave-dock confirms the next legs departure boundary.
 */
export const DEPART_NEXT_ML_PREDICTION_TYPES = [
  "AtDockDepartNext",
  "AtSeaDepartNext",
] as const;

/**
 * Builds the eventsPredicted boundary Key for depart-next rows on the following leg.
 *
 * NextScheduleKey on completed trips references the upcoming segment; pairing it with
 * dep-dock matches rows emitted by buildPredictedDockWriteBatch for the next departure.
 *
 * @param nextScheduleKey - Schedule segment key stored on the completed trip row
 * @returns Canonical dep-dock boundary Key string used for prediction lookups
 */
const buildDepartNextDepDockBoundaryKey = (nextScheduleKey: string): string =>
  buildBoundaryKey(nextScheduleKey, "dep-dock");

type DepartNextLegContext =
  | { ok: false; reason: "no_next_leg_context" }
  | { ok: true; depKey: string; actualMs: number };

/**
 * Validates that completed-trip metadata is sufficient to patch depart-next predictions.
 *
 * Requires NextScheduleKey for addressing rows and SailingDay so mutations scope to
 * the correct calendar partition. Floors feed milliseconds to seconds for stable Actual fields.
 *
 * @param completed - Completed trip document carrying optional next-leg pointers
 * @param actualDepartMs - Measured next-leg departure time from feed or dock sensors
 * @returns Success tuple with dep Key and normalized actual ms, or a structured failure reason
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
    actualMs: floorToSecond(actualDepartMs),
  };
};
