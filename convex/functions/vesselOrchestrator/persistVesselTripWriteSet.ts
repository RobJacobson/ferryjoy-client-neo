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
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/updateVesselPredictions";
import type {
  RunUpdateVesselTripsOutput,
  TripComputation,
} from "domain/vesselOrchestration/updateVesselTrips";
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
  mutations: VesselTripTableMutations
): Promise<VesselTripPersistResult> => {
  const persistable = translateTripsForPersistence(trips);

  const settled = await Promise.allSettled(
    persistable.completedFacts.map((fact) =>
      mutations.completeAndStartNewTrip({
        completedTrip: stripTripPredictionsForStorage(fact.tripToComplete),
        newTrip: stripTripPredictionsForStorage(
          fact.newTripCore.withFinalSchedule
        ),
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
  trips: RunUpdateVesselTripsOutput
): PersistableTripsBoundary => {
  const activeTripKeys = new Set(
    trips.activeTrips.map((trip) => persistedActiveTripKey(trip))
  );
  const currentTripComputations = trips.tripComputations.filter(
    isCurrentTripBranchComputation
  );
  const completedTripComputations = trips.tripComputations.filter(
    isCompletedTripBranchComputation
  );

  if (completedTripComputations.length !== trips.completedTrips.length) {
    throw new Error(
      "[VesselTrips] completedTrips length mismatch with completed trip computations"
    );
  }

  return {
    completedFacts: completedTripComputations.map(
      completedFactFromComputationOrThrow
    ),
    currentBranch: {
      activeTripRows: currentTripComputations.flatMap((computation) =>
        isPersistedCurrentTripComputation(computation, activeTripKeys)
          ? [stripTripPredictionsForStorage(computation.activeTrip)]
          : []
      ),
      pendingActualMessages: currentTripComputations.flatMap((computation) => {
        const actualMessage = currentActualMessageFromComputation(computation);
        return actualMessage === null
          ? []
          : [
              {
                ...actualMessage,
                requiresSuccessfulUpsert: isPersistedCurrentTripComputation(
                  computation,
                  activeTripKeys
                ),
              },
            ];
      }),
      pendingPredictedMessages: currentTripComputations.flatMap(
        (computation) => {
          const predictedMessage =
            currentPredictedMessageFromComputation(computation);
          return predictedMessage === null
            ? []
            : [
                {
                  ...predictedMessage,
                  requiresSuccessfulUpsert: isPersistedCurrentTripComputation(
                    computation,
                    activeTripKeys
                  ),
                },
              ];
        }
      ),
      leaveDockIntents: currentTripComputations.flatMap((computation) =>
        shouldPersistLeaveDockIntent(computation, activeTripKeys)
          ? [
              {
                vesselAbbrev: computation.vesselAbbrev,
                actualDepartMs: computation.activeTrip.LeftDockActual,
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

const isCompletedTripBranchComputation = (
  computation: TripComputation
): computation is TripComputation & {
  branch: "completed";
} =>
  computation.branch === "completed";

const completedFactFromComputationOrThrow = (
  computation: TripComputation & { branch: "completed" }
): CompletedTripBoundaryFact => {
  if (
    computation.existingTrip === undefined ||
    computation.completedTrip === undefined ||
    computation.tripCore.gates === undefined
  ) {
    throw new Error(
      `[VesselTrips] completed trip computation for ${computation.vesselAbbrev} is missing required persistence fields`
    );
  }

  return {
    existingTrip: computation.existingTrip,
    tripToComplete: computation.completedTrip,
    newTripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
      gates: computation.tripCore.gates,
    },
  };
};

const isCurrentTripBranchComputation = (
  computation: TripComputation
): computation is TripComputation & {
  branch: "current";
} =>
  computation.branch === "current";

const currentActualMessageFromComputation = (
  computation: TripComputation & { branch: "current" }
): Omit<CurrentTripActualEventMessage, "requiresSuccessfulUpsert"> | null => {
  if (computation.events === undefined) {
    return null;
  }
  if (computation.tripCore.gates === undefined) {
    throw new Error(
      `[VesselTrips] current actual trip computation for ${computation.vesselAbbrev} is missing tripCore.gates`
    );
  }

  return {
    events: computation.events,
    tripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
      gates: computation.tripCore.gates,
    },
    vesselAbbrev: computation.vesselAbbrev,
  };
};

const currentPredictedMessageFromComputation = (
  computation: TripComputation & { branch: "current" }
): Omit<CurrentTripPredictedEventMessage, "requiresSuccessfulUpsert"> | null => {
  if (computation.tripCore.gates === undefined) {
    return null;
  }

  return {
    existingTrip: computation.existingTrip,
    tripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
      gates: computation.tripCore.gates,
    },
    vesselAbbrev: computation.vesselAbbrev,
  };
};

const persistedActiveTripKey = (
  trip: Pick<ConvexVesselTrip, "VesselAbbrev" | "TripKey">
): string => `${trip.VesselAbbrev}::${trip.TripKey ?? "no-trip-key"}`;

const isPersistedCurrentTripComputation = (
  computation: TripComputation & {
    activeTrip?: NonNullable<TripComputation["activeTrip"]>;
  },
  activeTripKeys: Set<string>
): computation is TripComputation & {
  activeTrip: NonNullable<TripComputation["activeTrip"]>;
} =>
  computation.activeTrip !== undefined &&
  activeTripKeys.has(
    persistedActiveTripKey(
      stripTripPredictionsForStorage(computation.activeTrip)
    )
  );

const shouldPersistLeaveDockIntent = (
  computation: TripComputation & {
    activeTrip?: NonNullable<TripComputation["activeTrip"]>;
    events?: NonNullable<TripComputation["events"]>;
  },
  activeTripKeys: Set<string>
): computation is TripComputation & {
  activeTrip: NonNullable<TripComputation["activeTrip"]> & {
    LeftDockActual: number;
  };
  events: NonNullable<TripComputation["events"]>;
} =>
  computation.events?.didJustLeaveDock === true &&
  computation.activeTrip?.LeftDockActual !== undefined &&
  isPersistedCurrentTripComputation(computation, activeTripKeys);

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
