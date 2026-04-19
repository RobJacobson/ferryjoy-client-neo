/**
 * Vessel trips compute persistence: handoffs, active batch upsert, leave-dock follow-ups.
 * Convex I/O is supplied via {@link VesselTripTableMutations}.
 */

import type { TripLifecycleApplyOutcome } from "domain/vesselOrchestration/updateTimeline";
import type {
  PendingLeaveDockEffect,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/updateVesselTrips";
import {
  buildVesselTripsExecutionPayloads,
  completedFactsForSuccessfulHandoffs,
  type VesselTripsExecutionPayload,
} from "./vesselTripsExecutionPayloads";

export type VesselTripUpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
};

export type VesselTripTableMutations = {
  completeAndStartNewTrip: (
    args: VesselTripsExecutionPayload["handoffMutations"][number]
  ) => Promise<unknown>;
  upsertVesselTripsBatch: (args: {
    activeUpserts: NonNullable<
      VesselTripsExecutionPayload["activeUpsertBatch"]
    >;
  }) => Promise<VesselTripUpsertBatchResult>;
  setDepartNextActualsForMostRecentCompletedTrip: (args: {
    vesselAbbrev: string;
    actualDepartMs: number;
  }) => Promise<unknown>;
};

export const persistVesselTripsCompute = async (
  tripsCompute: VesselTripsComputeBundle,
  mutations: VesselTripTableMutations
): Promise<TripLifecycleApplyOutcome> => {
  const payload = buildVesselTripsExecutionPayloads(tripsCompute);

  const settled = await Promise.allSettled(
    payload.handoffMutations.map((row) =>
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
  if (
    payload.activeUpsertBatch !== null &&
    payload.activeUpsertBatch.length > 0
  ) {
    successfulVessels = successfulVesselAbbrevsFromUpsert(
      await mutations.upsertVesselTripsBatch({
        activeUpserts: payload.activeUpsertBatch,
      })
    );
  }

  await runLeaveDockPostPersistEffects(
    mutations,
    successfulVessels,
    payload.leaveDockEffects
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

const runLeaveDockPostPersistEffects = async (
  mutations: VesselTripTableMutations,
  successfulVessels: Set<string>,
  pendingLeaveDockEffects: PendingLeaveDockEffect[]
): Promise<void> => {
  await Promise.allSettled(
    pendingLeaveDockEffects
      .filter((effect) => successfulVessels.has(effect.vesselAbbrev))
      .map(async (effect) => {
        try {
          const leftDockMs = effect.trip.LeftDockActual ?? effect.trip.LeftDock;
          if (leftDockMs === undefined) {
            return;
          }

          await mutations.setDepartNextActualsForMostRecentCompletedTrip({
            vesselAbbrev: effect.vesselAbbrev,
            actualDepartMs: leftDockMs,
          });
        } catch (error) {
          console.error("[VesselTrips] leave-dock post-persist failed", {
            vesselAbbrev: effect.vesselAbbrev,
            trip: effect.trip,
            error,
          });
        }
      })
  );
};
