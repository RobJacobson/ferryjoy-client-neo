/**
 * Persistence adapter for vessel-location update stage.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type {
  ConvexVesselLocation,
  ConvexVesselLocationIncoming,
} from "functions/vesselLocation/schemas";

/**
 * Persists the full normalized location batch and returns changed rows only.
 *
 * @param ctx - Convex action context
 * @param locations - Normalized incoming rows for this ingest tick (no `AtDockObserved`)
 * @returns Inserted/replaced location rows after mutation-side dedupe
 */
export const persistVesselLocationBatch = async (
  ctx: ActionCtx,
  locations: ReadonlyArray<ConvexVesselLocationIncoming>
): Promise<ReadonlyArray<ConvexVesselLocation>> =>
  ctx.runMutation(
    internal.functions.vesselLocation.mutations.bulkUpsertVesselLocations,
    {
      locations: Array.from(locations),
    }
  );
