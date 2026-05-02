/**
 * Helpers for patching depart-next ML rows on `eventsPredicted`.
 */

import type { MutationCtx } from "_generated/server";
import type { UpdateLeaveDockEventPatch } from "domain/vesselOrchestration/updateLeaveDockEventPatch";
import { patchDepartNextMlRowsForDepBoundary } from "./mutations";

export type PatchDepartNextMlRowsResult = {
  updated: boolean;
  reason?: string;
};

/**
 * Applies a leave-dock patch to depart-next ML predictions on `eventsPredicted`.
 *
 * Delegates to `patchDepartNextMlRowsForDepBoundary` so orchestrator and domain
 * code share one code path for stamping `Actual` and `DeltaTotal` on departure.
 *
 * @param ctx - Convex mutation context
 * @param patch - Observed leave-dock boundary and departure instant
 * @returns Result with `updated` and optional `reason` when no ML rows matched
 */
export const patchDepartNextMlRows = async (
  ctx: MutationCtx,
  patch: UpdateLeaveDockEventPatch
): Promise<PatchDepartNextMlRowsResult> => {
  const anyUpdated = await patchDepartNextMlRowsForDepBoundary(
    ctx,
    patch.depBoundaryKey,
    patch.actualDepartMs
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
