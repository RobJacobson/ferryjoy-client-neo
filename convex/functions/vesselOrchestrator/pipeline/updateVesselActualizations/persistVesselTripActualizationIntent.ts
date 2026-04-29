/**
 * Stage helper for persisting trip actualization intent.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { DepartNextActualizationIntent } from "domain/vesselOrchestration/updateVesselActualizations";

/**
 * Persists one depart-next actualization intent through `eventsPredicted`.
 *
 * @param ctx - Convex action context
 * @param intent - Explicit intent produced from the trip update stage
 * @returns Whether any rows were updated and optional no-op reason
 */
export const persistVesselTripActualizationIntent = async (
  ctx: ActionCtx,
  intent: DepartNextActualizationIntent
): Promise<{
  updated: boolean;
  reason?: string;
}> =>
  ctx.runMutation(
    internal.functions.events.eventsPredicted.mutations
      .actualizeDepartNextFromIntent,
    {
      vesselAbbrev: intent.vesselAbbrev,
      depBoundaryKey: intent.depBoundaryKey,
      actualDepartMs: intent.actualDepartMs,
    }
  );
