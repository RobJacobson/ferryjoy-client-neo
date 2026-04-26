/**
 * Vessel-orchestrator trip persistence: apply one functions-owned translation
 * from the public trips DTOs to Convex mutations.
 *
 * The trips concern owns the public trip-computation contract, including
 * provisional trip fields already inferred from schedule evidence. This module
 * owns only the one-way translation needed to persist those outputs.
 */

import type { MutationCtx } from "_generated/server";
import type {
  ActualDockWriteIntent,
  CompletedArrivalHandoff,
  PersistedTripTimelineHandoff,
  PredictedDockWriteIntent,
  TripLifecycleEventFlags,
} from "domain/vesselOrchestration/shared";
import {
  areTripStorageRowsEqual,
  stripTripPredictionsForStorage,
} from "domain/vesselOrchestration/shared";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  completeAndStartNewTripInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
  upsertVesselTripsBatchInDb,
} from "functions/vesselTrips/mutations";

export type VesselTripWrites = {
  completedTripWrites: CompletedArrivalHandoff[];
  activeTripUpserts: ConvexVesselTrip[];
  actualDockWrites: ActualDockWriteIntent[];
  predictedDockWrites: PredictedDockWriteIntent[];
};

export const buildVesselTripWrites = (
  tripRows: RunUpdateVesselTripsOutput,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): VesselTripWrites => {
  const existingByVessel = new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const completedTripsByVessel = new Map(
    tripRows.completedTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  const completedTripWrites = [...completedTripsByVessel.entries()].flatMap(
    ([vesselAbbrev, completedTrip]) => {
      const existingTripForVessel = existingByVessel.get(vesselAbbrev);
      const replacementActiveTrip = replacementActiveTripForCompletedVessel(
        tripRows.activeTrips,
        completedTrip
      );
      if (
        existingTripForVessel === undefined ||
        replacementActiveTrip === undefined
      ) {
        console.error(
          `[VesselTrips] Skip completion for ${vesselAbbrev}: missing existing or replacement trip`
        );
        return [];
      }

      const completionFact: CompletedArrivalHandoff = {
        existingTrip: existingTripForVessel,
        tripToComplete: completedTrip,
        events: completionTripEvents(existingTripForVessel, completedTrip),
        scheduleTrip: replacementActiveTrip,
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

  const actualDockWrites = activeTripUpserts.flatMap((nextTrip) => {
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
      } satisfies ActualDockWriteIntent,
    ];
  });

  const predictedDockWrites: PredictedDockWriteIntent[] = activeTripUpserts.map(
    (nextTrip) => ({
      existingTrip: existingByVessel.get(nextTrip.VesselAbbrev),
      scheduleTrip: nextTrip,
      vesselAbbrev: nextTrip.VesselAbbrev,
      requiresSuccessfulUpsert: true,
    })
  );

  return {
    completedTripWrites,
    activeTripUpserts,
    actualDockWrites,
    predictedDockWrites,
  };
};

/**
 * Persists one tick of trip-table writes from precomputed write rows.
 *
 * @param ctx - Convex mutation context
 * @param tripWrites - Trip write rows and timeline handoff inputs
 * @returns Persisted handoff used by timeline assembly
 */
export const persistVesselTripWrites = async (
  ctx: MutationCtx,
  tripWrites: VesselTripWrites
): Promise<PersistedTripTimelineHandoff> => {
  const {
    completedTripWrites,
    activeTripUpserts,
    actualDockWrites,
    predictedDockWrites,
  } = tripWrites;

  const completedSettled = await Promise.allSettled(
    completedTripWrites.map((fact) =>
      completeAndStartNewTripInDb(
        ctx,
        stripTripPredictionsForStorage(fact.tripToComplete),
        stripTripPredictionsForStorage(fact.scheduleTrip)
      )
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
      await upsertVesselTripsBatchInDb(ctx, activeTripUpserts)
    );
  }

  const successfulCompletedFacts = completedTripWrites.filter((_, idx) => {
    const result = completedSettled[idx];
    return result?.status === "fulfilled";
  });
  await runLeaveDockFromWriteSetIntents(
    ctx,
    successfulVessels,
    actualDockWrites
  );

  return {
    completedFacts: successfulCompletedFacts,
    currentBranch: {
      successfulVessels,
      pendingActualMessages: actualDockWrites,
      pendingPredictedMessages: predictedDockWrites,
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
): TripLifecycleEventFlags => ({
  isFirstTrip: false,
  isTripStartReady: true,
  isCompletedTrip: true,
  didJustArriveAtDock:
    completedTrip.ArrivedNextActual !== undefined &&
    existingTrip.ArrivedNextActual !== completedTrip.ArrivedNextActual,
  didJustLeaveDock: false,
  scheduleKeyChanged: existingTrip.ScheduleKey !== completedTrip.ScheduleKey,
});

/**
 * Derives current-branch event flags from existing and next active rows.
 */
const currentTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): TripLifecycleEventFlags => ({
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
  scheduleKeyChanged: existingTrip?.ScheduleKey !== nextTrip.ScheduleKey,
});

/**
 * Collects vessel abbrevs whose active-trip upsert succeeded.
 *
 * @param upsertResult - Per-vessel upsert outcomes from batch mutation
 * @returns Set of vessel abbrevs that can pass upsert-gated downstream writes
 */
const successfulVesselAbbrevsFromUpsert = (
  upsertResult: Awaited<ReturnType<typeof upsertVesselTripsBatchInDb>>
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
  ctx: MutationCtx,
  successfulVessels: Set<string>,
  actualDockWrites: ReadonlyArray<ActualDockWriteIntent>
): Promise<void> => {
  const departNextActualWrites = actualDockWrites
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

  await Promise.allSettled(
    departNextActualWrites
      .filter((intent) => successfulVessels.has(intent.vesselAbbrev))
      .map(async (intent) => {
        try {
          await setDepartNextActualsForMostRecentCompletedTripInDb(
            ctx,
            intent.vesselAbbrev,
            intent.actualDepartMs
          );
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
