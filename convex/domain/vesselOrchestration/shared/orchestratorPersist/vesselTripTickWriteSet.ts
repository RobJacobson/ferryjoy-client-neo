/**
 * Serializable **write set** for one vessel-trips tick: storage-shaped trip rows
 * plus leave-dock **intents** for depart-next actualization.
 *
 * Step 2 contract toward "pure domain -> idempotent persistence" (Step 3). Rows
 * use {@link ConvexVesselTrip} (predictions stripped); they are JSON-serializable
 * POJOs.
 *
 * **Completed handoffs** - One entry per `completedHandoffs` bundle row (**attempted**
 * writes), same cardinality as `buildTripsComputeStorageRows`'s
 * `handoffMutations`. Success is decided later in `persistVesselTripWriteSet`
 * (`Promise.allSettled`), not here.
 *
 * **Active trips** - Normalized to a **readonly array** (never `null`). Use `[]`
 * when there is no batch.
 *
 * **Leave-dock** - Intents for `setDepartNextActualsForMostRecentCompletedTrip`.
 * The static write set lists every pending effect with a defined
 * `LeftDockActual ?? LeftDock`. **Production** additionally filters intents by
 * `successfulVessels` after the active upsert batch (see `persistVesselTripWriteSet`
 * in `persistVesselTripsCompute.ts`); this type does not encode that gate.
 */

import type { VesselTripsComputeBundle } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { actualDepartMsForLeaveDockEffect } from "./leaveDockActualization";
import { buildTripsComputeStorageRows } from "./tripsComputeStorageRows";

/**
 * Storage-oriented trip writes for one orchestrator tick (two buckets + leave-dock intents).
 */
export type VesselTripTickWriteSet = {
  /**
   * Attempted complete-and-start handoffs (`completeAndStartNewTrip`), one per
   * bundle completed handoff.
   */
  readonly attemptedHandoffs: ReadonlyArray<{
    completedTrip: ConvexVesselTrip;
    newTrip: ConvexVesselTrip;
  }>;
  /**
   * Active trip upserts (`upsertVesselTripsBatch`). Empty when the payload has
   * no batch (including when `activeUpsertBatch` is `null` in execution payloads).
   */
  readonly activeTripRows: ReadonlyArray<ConvexVesselTrip>;
  /**
   * Depart-next actualization intents. Omits effects with no `actualDepartMs`.
   */
  readonly leaveDockIntents: ReadonlyArray<{
    vesselAbbrev: string;
    actualDepartMs: number;
  }>;
};

/**
 * Builds a {@link VesselTripTickWriteSet} from the same strip/group rules as
 * {@link buildTripsComputeStorageRows}.
 */
export const buildVesselTripTickWriteSetFromBundle = (
  tripsCompute: VesselTripsComputeBundle
): VesselTripTickWriteSet => {
  const payload = buildTripsComputeStorageRows(tripsCompute);
  const leaveDockIntents: Array<{
    vesselAbbrev: string;
    actualDepartMs: number;
  }> = [];
  for (const effect of payload.leaveDockEffects) {
    const actualDepartMs = actualDepartMsForLeaveDockEffect(effect);
    if (actualDepartMs === undefined) {
      continue;
    }
    leaveDockIntents.push({
      vesselAbbrev: effect.vesselAbbrev,
      actualDepartMs,
    });
  }
  return {
    attemptedHandoffs: payload.handoffMutations,
    activeTripRows:
      payload.activeUpsertBatch === null ? [] : payload.activeUpsertBatch,
    leaveDockIntents,
  };
};
