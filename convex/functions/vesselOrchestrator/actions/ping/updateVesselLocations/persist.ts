/**
 * Thin action adapter for the location-stage mutation.
 *
 * Forwards normalized rows to `bulkUpsertVesselLocations` and returns
 * changed locations plus post-write active trips from that transaction.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type {
  ConvexVesselLocation,
  ConvexVesselLocationIncoming,
} from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type PersistVesselLocationBatchResult = {
  changedLocations: ReadonlyArray<ConvexVesselLocation>;
  activeTripsForChanged: ReadonlyArray<ConvexVesselTrip>;
};

/**
 * Persists the full normalized location batch and returns changed rows plus
 * active trips for those vessels (same transaction as the upserts).
 *
 * Thin `runMutation` wrapper around `bulkUpsertVesselLocations` so the location
 * stage keeps a single persistence choke point. `AtDockObserved` continuity is
 * owned inside that mutation; callers pass pre-normalized rows only.
 *
 * @param ctx - Convex action context
 * @param locations - Normalized incoming rows for this ingest tick (no
 *   `AtDockObserved`)
 * @returns Changed locations and matching active trip rows after mutation-side
 *   dedupe
 */
export const persistVesselLocationBatch = async (
  ctx: ActionCtx,
  locations: ReadonlyArray<ConvexVesselLocationIncoming>
): Promise<PersistVesselLocationBatchResult> =>
  ctx.runMutation(
    internal.functions.vesselLocation.mutations.bulkUpsertVesselLocations,
    {
      locations: Array.from(locations),
    }
  );
