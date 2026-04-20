/**
 * Vessel-orchestrator trip persistence: apply one functions-owned translation
 * from the public trips DTOs to Convex mutations.
 *
 * The trips concern owns the public trip-computation contract. This module owns
 * only the one-way translation needed to persist those outputs through
 * `ActionCtx`-backed mutation bindings.
 */

import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
  VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/shared";
import type { VesselTripsComputeBundle } from "domain/vesselOrchestration/shared";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type VesselTripUpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
};

/**
 * Convex trip-table bindings for one persist pass. `activeUpserts` is mutable
 * because generated mutation args are not `readonly`.
 */
export type VesselTripTableMutations = {
  completeAndStartNewTrip: (args: {
    completedTrip: ConvexVesselTrip;
    newTrip: ConvexVesselTrip;
  }) => Promise<unknown>;
  upsertVesselTripsBatch: (args: {
    activeUpserts: ConvexVesselTrip[];
  }) => Promise<VesselTripUpsertBatchResult>;
  setDepartNextActualsForMostRecentCompletedTrip: (args: {
    vesselAbbrev: string;
    actualDepartMs: number;
  }) => Promise<unknown>;
};

type PersistableTripsBoundary = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: {
    activeTripRows: ConvexVesselTrip[];
    pendingActualMessages: CurrentTripActualEventMessage[];
    pendingPredictedMessages: CurrentTripPredictedEventMessage[];
    leaveDockIntents: Array<{
      vesselAbbrev: string;
      actualDepartMs: number;
    }>;
  };
};

/**
 * Persists one tick of trip-table writes from the canonical trips domain output.
 */
export const persistVesselTripWriteSet = async (
  trips: RunUpdateVesselTripsOutput,
  tripsCompute: VesselTripsComputeBundle,
  mutations: VesselTripTableMutations
): Promise<VesselTripPersistResult> => {
  const persistable = translateTripsForPersistence(trips, tripsCompute);

  const settled = await Promise.allSettled(
    persistable.completedFacts.map((fact) =>
      mutations.completeAndStartNewTrip({
        completedTrip: stripTripPredictionsForStorage(fact.tripToComplete),
        newTrip: stripTripPredictionsForStorage(fact.scheduleTrip),
      })
    )
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const fact = persistable.completedFacts[i];
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

  const completedFacts = successfulCompletedFacts(persistable, settled);

  let successfulVessels = new Set<string>();
  if (persistable.currentBranch.activeTripRows.length > 0) {
    successfulVessels = successfulVesselAbbrevsFromUpsert(
      await mutations.upsertVesselTripsBatch({
        activeUpserts: Array.from(persistable.currentBranch.activeTripRows),
      })
    );
  }

  await runLeaveDockFromWriteSetIntents(
    mutations,
    successfulVessels,
    persistable.currentBranch.leaveDockIntents
  );

  return {
    completedFacts,
    currentBranch: {
      successfulVessels,
      pendingActualMessages: persistable.currentBranch.pendingActualMessages,
      pendingPredictedMessages:
        persistable.currentBranch.pendingPredictedMessages,
    },
  };
};

const translateTripsForPersistence = (
  trips: RunUpdateVesselTripsOutput,
  tripsCompute: VesselTripsComputeBundle
): PersistableTripsBoundary => {
  const persistedVessels = new Set(
    trips.activeTrips.map((trip) => trip.VesselAbbrev)
  );

  if (tripsCompute.completedHandoffs.length !== trips.completedTrips.length) {
    throw new Error(
      "[VesselTrips] completedTrips length mismatch with completed handoffs"
    );
  }

  return {
    completedFacts: [...tripsCompute.completedHandoffs],
    currentBranch: {
      activeTripRows: tripsCompute.current.activeUpserts.map(
        stripTripPredictionsForStorage
      ),
      pendingActualMessages: tripsCompute.current.pendingActualMessages.map(
        (message) => ({
          ...message,
          requiresSuccessfulUpsert: persistedVessels.has(message.vesselAbbrev),
        })
      ),
      pendingPredictedMessages:
        tripsCompute.current.pendingPredictedMessages.map((message) => ({
          ...message,
          requiresSuccessfulUpsert: persistedVessels.has(message.vesselAbbrev),
        })),
      leaveDockIntents: tripsCompute.current.pendingLeaveDockEffects.flatMap(
        (effect) =>
          persistedVessels.has(effect.vesselAbbrev) &&
          effect.trip.LeftDockActual !== undefined
            ? [
                {
                  vesselAbbrev: effect.vesselAbbrev,
                  actualDepartMs: effect.trip.LeftDockActual,
                },
              ]
            : []
      ),
    },
  };
};

const successfulCompletedFacts = (
  persistable: PersistableTripsBoundary,
  settled: PromiseSettledResult<unknown>[]
): CompletedTripBoundaryFact[] => {
  const completedFacts: CompletedTripBoundaryFact[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const fact = persistable.completedFacts[i];
    if (result?.status === "fulfilled" && fact !== undefined) {
      completedFacts.push(fact);
    }
  }
  return completedFacts;
};

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
 * successful active upsert.
 */
const runLeaveDockFromWriteSetIntents = async (
  mutations: VesselTripTableMutations,
  successfulVessels: Set<string>,
  leaveDockIntents: PersistableTripsBoundary["currentBranch"]["leaveDockIntents"]
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
