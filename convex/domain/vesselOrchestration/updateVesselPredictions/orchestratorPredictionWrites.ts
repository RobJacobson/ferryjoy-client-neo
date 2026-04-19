/**
 * Trip tick -> ML overlay (`applyVesselPredictions` on `buildTripCore` outputs only).
 *
 * - **Proposals:** derived from the computed {@link VesselTripsComputeBundle} each time (idempotent upserts).
 * - **Timeline:** merged later by `updateTimeline` using vessel/schedule keys, so the
 *   predictions pass may recompute the tick independently of the persist pass.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
  TripLifecycleApplyOutcome,
} from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripsComputeBundle } from "domain/vesselOrchestration/updateVesselTrips";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { applyVesselPredictions } from "./applyVesselPredictions";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

export type VesselTripPredictionsMutationArgs = {
  proposals: VesselTripPredictionProposal[];
};

const tripLifecycleOutcomeFromTripsCompute = (
  tripsCompute: VesselTripsComputeBundle
): TripLifecycleApplyOutcome => ({
  completedFacts: [...tripsCompute.completedHandoffs],
  currentBranch: {
    successfulVessels: new Set(),
    pendingActualMessages: tripsCompute.current.pendingActualMessages,
    pendingPredictedMessages: tripsCompute.current.pendingPredictedMessages,
  },
});

/** ML overlay for one {@link VesselTripsComputeBundle} (full compute, not persist-filtered). */
export const buildMlOverlayFromTripsCompute = async (
  tripsCompute: VesselTripsComputeBundle,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<TripLifecycleApplyOutcome> =>
  overlayMlOnTripLifecycleApply(
    tripLifecycleOutcomeFromTripsCompute(tripsCompute),
    predictionModelAccess
  );

export const vesselTripPredictionProposalsFromMlOverlay = (
  mlFull: TripLifecycleApplyOutcome
): VesselTripPredictionProposal[] => predictionRowsFromMergedApply(mlFull);

export type VesselTripPredictionWrites = {
  proposals: VesselTripPredictionProposal[];
  mlFull: TripLifecycleApplyOutcome;
};

/**
 * Full ML overlay plus flattened prediction rows for one {@link VesselTripsComputeBundle}.
 * Domain owns how proposals are derived from the merged apply outcome.
 */
export const runUpdateVesselPredictions = async (
  tripsCompute: VesselTripsComputeBundle,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<VesselTripPredictionWrites> => {
  const mlFull = await buildMlOverlayFromTripsCompute(
    tripsCompute,
    predictionModelAccess
  );
  return {
    proposals: vesselTripPredictionProposalsFromMlOverlay(mlFull),
    mlFull,
  };
};

/** `vesselTripPredictions` batch args from a full trips compute (idempotent upsert rows). */
export const buildVesselTripPredictionProposals = async (
  tripsCompute: VesselTripsComputeBundle,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<VesselTripPredictionsMutationArgs> => {
  const { proposals } = await runUpdateVesselPredictions(
    tripsCompute,
    predictionModelAccess
  );
  return { proposals };
};

const overlayMlOnTripLifecycleApply = async (
  applyTripResult: TripLifecycleApplyOutcome,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<TripLifecycleApplyOutcome> => {
  const completedFacts = await attachMlToCompletedFacts(
    applyTripResult.completedFacts,
    predictionModelAccess
  );

  const { actual, predicted } = await attachMlToCurrentBranchMessages(
    applyTripResult.currentBranch.pendingActualMessages,
    applyTripResult.currentBranch.pendingPredictedMessages,
    predictionModelAccess
  );

  return {
    completedFacts,
    currentBranch: {
      successfulVessels: applyTripResult.currentBranch.successfulVessels,
      pendingActualMessages: actual,
      pendingPredictedMessages: predicted,
    },
  };
};

const attachMlToCompletedFacts = async (
  facts: CompletedTripBoundaryFact[],
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<CompletedTripBoundaryFact[]> =>
  Promise.all(
    facts.map(async (fact) => ({
      ...fact,
      newTrip: await applyVesselPredictions(
        predictionModelAccess,
        fact.newTripCore.withFinalSchedule,
        fact.newTripCore.gates
      ),
    }))
  );

const attachMlToCurrentBranchMessages = async (
  pendingActualMessages: CurrentTripActualEventMessage[],
  pendingPredictedMessages: CurrentTripPredictedEventMessage[],
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<{
  actual: CurrentTripActualEventMessage[];
  predicted: CurrentTripPredictedEventMessage[];
}> => {
  const coreByVessel = new Map(
    [...pendingActualMessages, ...pendingPredictedMessages].map(
      (m) => [m.vesselAbbrev, m.tripCore] as const
    )
  );

  const mlByVessel = new Map<string, ConvexVesselTripWithML>();

  await Promise.all(
    [...coreByVessel.entries()].map(async ([vesselAbbrev, tripCore]) => {
      const ml = await applyVesselPredictions(
        predictionModelAccess,
        tripCore.withFinalSchedule,
        tripCore.gates
      );
      mlByVessel.set(vesselAbbrev, ml);
    })
  );

  const requireMl = (finalProposed: ConvexVesselTripWithML | undefined) => {
    if (finalProposed === undefined) {
      throw new Error("Missing predicted trip for current-trip message");
    }
    return finalProposed;
  };

  return {
    actual: pendingActualMessages.map((m) => ({
      ...m,
      finalProposed: requireMl(mlByVessel.get(m.vesselAbbrev)),
    })),
    predicted: pendingPredictedMessages.map((m) => ({
      ...m,
      finalProposed: requireMl(mlByVessel.get(m.vesselAbbrev)),
    })),
  };
};

const predictionRowsFromMergedApply = (
  merged: TripLifecycleApplyOutcome
): VesselTripPredictionProposal[] => {
  const fromCompleted = merged.completedFacts.flatMap((f) =>
    f.newTrip !== undefined
      ? vesselTripPredictionProposalsFromMlTrip(f.newTrip)
      : []
  );
  const byVessel = new Map<string, ConvexVesselTripWithML>();
  for (const m of [
    ...merged.currentBranch.pendingActualMessages,
    ...merged.currentBranch.pendingPredictedMessages,
  ]) {
    if (m.finalProposed !== undefined) {
      byVessel.set(m.vesselAbbrev, m.finalProposed);
    }
  }
  const fromCurrent = [...byVessel.values()].flatMap((t) =>
    vesselTripPredictionProposalsFromMlTrip(t)
  );
  return [...fromCompleted, ...fromCurrent];
};
