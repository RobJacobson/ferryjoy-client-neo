/**
 * Vessel trips compute persistence: handoffs, active batch upsert, leave-dock follow-ups.
 * Convex I/O is supplied via {@link VesselTripTableMutations}.
 *
 * The canonical entry is {@link persistVesselTripWriteSet} (drives mutations from
 * {@link buildVesselTripTickWriteSetFromBundle}); this file name matches the legacy
 * export {@link persistVesselTripsCompute}.
 */

import type { VesselTripPersistResult } from "domain/vesselOrchestration/shared";
import type { VesselTripsComputeBundle } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { completedFactsForSuccessfulHandoffs } from "./tripsComputeStorageRows";
import {
  buildVesselTripTickWriteSetFromBundle,
  type VesselTripTickWriteSet,
} from "./vesselTripTickWriteSet";

export type VesselTripUpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
};

/**
 * Convex trip-table bindings for one persist pass. `activeUpserts` is a mutable
 * `ConvexVesselTrip[]` because generated mutation args are not `readonly`.
 */
export type VesselTripTableMutations = {
  completeAndStartNewTrip: (
    args: VesselTripTickWriteSet["attemptedHandoffs"][number]
  ) => Promise<unknown>;
  upsertVesselTripsBatch: (args: {
    activeUpserts: ConvexVesselTrip[];
  }) => Promise<VesselTripUpsertBatchResult>;
  setDepartNextActualsForMostRecentCompletedTrip: (args: {
    vesselAbbrev: string;
    actualDepartMs: number;
  }) => Promise<unknown>;
};

/**
 * Persists one tick of vessel trip writes from {@link buildVesselTripTickWriteSetFromBundle}
 * (handoffs, active upsert batch, leave-dock intents gated by successful upserts).
 *
 * @param tripsCompute - Bundle for outcome fields and completed-handoff facts indexing
 * @param mutations - Convex trip table mutation bindings
 * @returns Trip-native persist outcome; alias-compatible with timeline merge types
 */
export const persistVesselTripWriteSet = async (
  tripsCompute: VesselTripsComputeBundle,
  mutations: VesselTripTableMutations
): Promise<VesselTripPersistResult> => {
  const writeSet = buildVesselTripTickWriteSetFromBundle(tripsCompute);
  if (
    writeSet.attemptedHandoffs.length !== tripsCompute.completedHandoffs.length
  ) {
    throw new Error(
      "[VesselTrips] attemptedHandoffs length mismatch with completedHandoffs"
    );
  }

  const settled = await Promise.allSettled(
    writeSet.attemptedHandoffs.map((row) =>
      mutations.completeAndStartNewTrip(row)
    )
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const fact = tripsCompute.completedHandoffs[i];
    if (result?.status === "rejected" && fact !== undefined) {
      const err =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));
      const vesselAbbrev = fact.tripToComplete.VesselAbbrev;
      console.error(
        `[VesselTrips] Failed completed-trip processing for ${vesselAbbrev}: ${err.message}`,
        err
      );
    }
  }

  const completedFacts = completedFactsForSuccessfulHandoffs(
    tripsCompute,
    settled
  );

  let successfulVessels = new Set<string>();
  if (writeSet.activeTripRows.length > 0) {
    successfulVessels = successfulVesselAbbrevsFromUpsert(
      await mutations.upsertVesselTripsBatch({
        activeUpserts: Array.from(writeSet.activeTripRows),
      })
    );
  }

  await runLeaveDockFromWriteSetIntents(
    mutations,
    successfulVessels,
    writeSet.leaveDockIntents
  );

  return {
    completedFacts,
    currentBranch: {
      successfulVessels,
      pendingActualMessages: tripsCompute.current.pendingActualMessages,
      pendingPredictedMessages: tripsCompute.current.pendingPredictedMessages,
    },
  };
};

/** Same implementation as {@link persistVesselTripWriteSet} (legacy export name). */
export const persistVesselTripsCompute = persistVesselTripWriteSet;

const successfulVesselAbbrevsFromUpsert = (
  upsertResult: VesselTripUpsertBatchResult
): Set<string> =>
  new Set(
    upsertResult.perVessel
      .filter((result) => {
        if (result.ok) {
          return true;
        }

        console.error(
          `[VesselTrips] Failed active-trip upsert for ${result.vesselAbbrev}: ${
            result.reason ?? "unknown error"
          }`
        );
        return false;
      })
      .map((result) => result.vesselAbbrev)
  );

/**
 * Runs depart-next actualization for leave-dock intents whose vessel had a
 * successful active upsert (`successfulVessels` gate).
 */
const runLeaveDockFromWriteSetIntents = async (
  mutations: VesselTripTableMutations,
  successfulVessels: Set<string>,
  leaveDockIntents: VesselTripTickWriteSet["leaveDockIntents"]
): Promise<void> => {
  await Promise.allSettled(
    leaveDockIntents
      .filter((intent) => successfulVessels.has(intent.vesselAbbrev))
      .map(async (intent) => {
        try {
          await mutations.setDepartNextActualsForMostRecentCompletedTrip({
            vesselAbbrev: intent.vesselAbbrev,
            actualDepartMs: intent.actualDepartMs,
          });
        } catch (error) {
          console.error("[VesselTrips] leave-dock post-persist failed", {
            vesselAbbrev: intent.vesselAbbrev,
            actualDepartMs: intent.actualDepartMs,
            error,
          });
        }
      })
  );
};
