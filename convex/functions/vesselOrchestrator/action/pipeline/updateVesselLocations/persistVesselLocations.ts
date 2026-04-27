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
 * This helper keeps persistence wiring separate from stage orchestration so the
 * caller can remain focused on sequencing while this function encapsulates the
 * Convex mutation contract and changed-row return semantics.
 *
 * @param ctx - Convex action context
 * @param locations - Normalized incoming rows for this ingest tick (no `AtDockObserved`)
 * @returns Inserted/replaced location rows after mutation-side dedupe
 */
export const persistVesselLocationBatch = async (
  ctx: ActionCtx,
  locations: ReadonlyArray<ConvexVesselLocationIncoming>
): Promise<ReadonlyArray<ConvexVesselLocation>> =>
  // Invoke the location bulk-upsert mutation with the full current batch.
  ctx.runMutation(
    internal.functions.vesselLocation.mutations.bulkUpsertVesselLocations,
    {
      // Convert readonly input into a mutable array payload for Convex args.
      locations: Array.from(locations),
    }
  );
