/**
 * Depart-next actualization helpers for `eventsPredicted`.
 */

import type { MutationCtx } from "_generated/server";
import type { DepartNextActualizationIntent } from "domain/vesselOrchestration/updateVesselActualizations";
import { actualizeDepartNextMlPredictions } from "./mutations";

export type DepartNextActualizationPersistResult = {
  updated: boolean;
  reason?: string;
};

/**
 * Applies one depart-next actualization intent to `eventsPredicted`.
 *
 * @param ctx - Convex mutation context
 * @param intent - Derived leave-dock actualization intent
 * @returns Whether any prediction rows were patched
 */
export const applyDepartNextActualizationIntentInDb = async (
  ctx: MutationCtx,
  intent: DepartNextActualizationIntent
): Promise<DepartNextActualizationPersistResult> => {
  const anyUpdated = await actualizeDepartNextMlPredictions(
    ctx,
    intent.depBoundaryKey,
    intent.actualDepartMs
  );
  if (!anyUpdated) {
    return {
      updated: false,
      reason: "no_predictions_to_update",
    };
  }
  return {
    updated: true,
  };
};
