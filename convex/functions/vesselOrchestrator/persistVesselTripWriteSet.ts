/**
 * Vessel-orchestrator trip persistence: apply one functions-owned translation
 * from the public trips DTOs to Convex mutations.
 *
 * The trips concern owns the public trip-computation contract, including
 * provisional trip fields already inferred from schedule evidence. This module
 * owns only the one-way translation needed to persist those outputs through
 * `ActionCtx`-backed mutation bindings.
 */

import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/shared";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
import { areTripStorageRowsEqual } from "domain/vesselOrchestration/updateVesselTrips/storage";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

type TripEvents = {
  isFirstTrip: boolean;
  isTripStartReady: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  scheduleKeyChanged: boolean;
};

/**
 * Result payload returned by `upsertVesselTripsBatch`.
 */
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

export type VesselTripPersistencePlan = {
  attemptedCompletedFacts: CompletedTripBoundaryFact[];
  activeTripUpserts: ConvexVesselTrip[];
  currentBranchMessages: Omit<
    CurrentTripLifecycleBranchResult,
    "successfulVessels"
  >;
  leaveDockIntents: Array<{
    vesselAbbrev: string;
    actualDepartMs: number;
  }>;
};

export const buildVesselTripPersistencePlan = (
  tripRows: RunUpdateVesselTripsOutput,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): VesselTripPersistencePlan => {
  const existingByVessel = new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const completedTripsByVessel = new Map(
    tripRows.completedTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  const attemptedCompletedFacts = [...completedTripsByVessel.entries()].flatMap(
    ([vesselAbbrev, completedTrip]) => {
      const existingTrip = existingByVessel.get(vesselAbbrev);
      const replacementTrip = replacementActiveTripForCompletedVessel(
        tripRows.activeTrips,
        completedTrip
      );
      if (existingTrip === undefined || replacementTrip === undefined) {
        console.error(
          `[VesselTrips] Skip completion for ${vesselAbbrev}: missing existing or replacement trip`
        );
        return [];
      }

      const completionFact: CompletedTripBoundaryFact = {
        existingTrip,
        tripToComplete: completedTrip,
        events: completionTripEvents(existingTrip, completedTrip),
        scheduleTrip: replacementTrip,
      };
      return [completionFact];
    }
  );

  const activeTripUpserts = tripRows.activeTrips
    .filter((trip) => !completedTripsByVessel.has(trip.VesselAbbrev))
    .map(stripTripPredictionsForStorage)
    .filter((nextTrip) => {
      const existingTrip = existingByVessel.get(nextTrip.VesselAbbrev);
      return !areTripStorageRowsEqual(existingTrip, nextTrip);
    });

  const currentEventsByVessel = new Map(
    activeTripUpserts.map((nextTrip) => {
      const existingTrip = existingByVessel.get(nextTrip.VesselAbbrev);
      return [
        nextTrip.VesselAbbrev,
        currentTripEvents(existingTrip, nextTrip),
      ] as const;
    })
  );

  const pendingActualMessages = activeTripUpserts.flatMap((nextTrip) => {
    const events = currentEventsByVessel.get(nextTrip.VesselAbbrev);
    if (
      events === undefined ||
      (!events.didJustLeaveDock && !events.didJustArriveAtDock)
    ) {
      return [];
    }
    return [
      {
        events,
        scheduleTrip: nextTrip,
        vesselAbbrev: nextTrip.VesselAbbrev,
        requiresSuccessfulUpsert: true,
      } satisfies CurrentTripActualEventMessage,
    ];
  });

  const pendingPredictedMessages = activeTripUpserts.map((nextTrip) => ({
    existingTrip: existingByVessel.get(nextTrip.VesselAbbrev),
    scheduleTrip: nextTrip,
    vesselAbbrev: nextTrip.VesselAbbrev,
    requiresSuccessfulUpsert: true,
  })) satisfies CurrentTripPredictedEventMessage[];

  const leaveDockIntents = pendingActualMessages
    .filter((message) => message.events.didJustLeaveDock)
    .flatMap((message) =>
      message.scheduleTrip.LeftDockActual === undefined
        ? []
        : [
            {
              vesselAbbrev: message.vesselAbbrev,
              actualDepartMs: message.scheduleTrip.LeftDockActual,
            },
          ]
    );

  return {
    attemptedCompletedFacts,
    activeTripUpserts,
    currentBranchMessages: {
      pendingActualMessages,
      pendingPredictedMessages,
    },
    leaveDockIntents,
  };
};

/**
 * Persists one tick of trip-table writes from the canonical trips domain output.
 */
export const persistVesselTripWriteSet = async (
  tripRows: RunUpdateVesselTripsOutput,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  mutations: VesselTripTableMutations
): Promise<VesselTripPersistResult> => {
  const plan = buildVesselTripPersistencePlan(tripRows, existingActiveTrips);
  const {
    attemptedCompletedFacts,
    activeTripUpserts,
    currentBranchMessages: { pendingActualMessages, pendingPredictedMessages },
    leaveDockIntents,
  } = plan;

  const completedSettled = await Promise.allSettled(
    attemptedCompletedFacts.map((fact) =>
      mutations.completeAndStartNewTrip({
        completedTrip: stripTripPredictionsForStorage(fact.tripToComplete),
        newTrip: stripTripPredictionsForStorage(fact.scheduleTrip),
      })
    )
  );

  for (const result of completedSettled) {
    if (result.status === "rejected") {
      const err =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));
      console.error(
        `[VesselTrips] Failed completed-trip processing: ${err.message}`,
        err
      );
    }
  }

  let successfulVessels = new Set<string>();
  if (activeTripUpserts.length > 0) {
    successfulVessels = successfulVesselAbbrevsFromUpsert(
      await mutations.upsertVesselTripsBatch({
        activeUpserts: [...activeTripUpserts],
      })
    );
  }

  const successfulCompletedFacts = attemptedCompletedFacts.filter((_, idx) => {
    const result = completedSettled[idx];
    return result?.status === "fulfilled";
  });
  await runLeaveDockFromWriteSetIntents(
    mutations,
    successfulVessels,
    leaveDockIntents
  );

  return {
    completedFacts: successfulCompletedFacts,
    currentBranch: {
      successfulVessels,
      pendingActualMessages,
      pendingPredictedMessages,
    },
  };
};

/**
 * Finds the replacement active trip for one completed trip rollover.
 */
const replacementActiveTripForCompletedVessel = (
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  completedTrip: ConvexVesselTrip
): ConvexVesselTrip | undefined =>
  activeTrips.find(
    (activeTrip) =>
      activeTrip.VesselAbbrev === completedTrip.VesselAbbrev &&
      activeTrip.TripKey !== completedTrip.TripKey
  );

const completionTripEvents = (
  existingTrip: ConvexVesselTrip,
  completedTrip: ConvexVesselTrip
): TripEvents => ({
  isFirstTrip: false,
  isTripStartReady: true,
  isCompletedTrip: true,
  didJustArriveAtDock:
    completedTrip.ArrivedNextActual !== undefined &&
    existingTrip.ArrivedNextActual !== completedTrip.ArrivedNextActual,
  didJustLeaveDock: false,
  leftDockTime: completedTrip.LeftDockActual ?? completedTrip.LeftDock,
  scheduleKeyChanged: existingTrip.ScheduleKey !== completedTrip.ScheduleKey,
});

/**
 * Derives current-branch event flags from existing and next active rows.
 */
const currentTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): TripEvents => ({
  isFirstTrip: existingTrip === undefined,
  isTripStartReady:
    nextTrip.DepartingTerminalAbbrev !== undefined &&
    nextTrip.ArrivingTerminalAbbrev !== undefined &&
    nextTrip.ScheduledDeparture !== undefined,
  isCompletedTrip: false,
  didJustArriveAtDock:
    existingTrip?.AtDock !== true &&
    nextTrip.AtDock === true &&
    nextTrip.ArrivedNextActual !== undefined,
  didJustLeaveDock:
    existingTrip?.AtDock === true &&
    nextTrip.AtDock !== true &&
    nextTrip.LeftDockActual !== undefined,
  leftDockTime: nextTrip.LeftDockActual ?? nextTrip.LeftDock,
  scheduleKeyChanged: existingTrip?.ScheduleKey !== nextTrip.ScheduleKey,
});

/**
 * Collects vessel abbrevs whose active-trip upsert succeeded.
 *
 * @param upsertResult - Per-vessel upsert outcomes from batch mutation
 * @returns Set of vessel abbrevs that can pass upsert-gated downstream writes
 */
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
  leaveDockIntents: Array<{
    vesselAbbrev: string;
    actualDepartMs: number;
  }>
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
