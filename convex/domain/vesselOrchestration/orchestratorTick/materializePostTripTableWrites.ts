/**
 * After trip lifecycle mutations: ML overlay and payloads for `vesselTripPredictions`
 * and timeline tables. One ML pass per tick.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import {
  buildTimelineTickProjectionInput,
  type CompletedTripBoundaryFact,
  type CurrentTripActualEventMessage,
  type CurrentTripPredictedEventMessage,
  type TimelineTickProjectionInput,
  type TripLifecycleApplyOutcome,
} from "domain/vesselOrchestration/updateTimeline";
import {
  applyVesselPredictions,
  vesselTripPredictionProposalsFromMlTrip,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";

export type VesselTripPredictionsMutationArgs = {
  proposals: VesselTripPredictionProposal[];
};

/** ML + `vesselTripPredictions` rows + merged branch (no timeline assembly). */
export const materializeVesselTripPredictionUpsertAndMergedBranch = async (
  applyTripResult: TripLifecycleApplyOutcome,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<{
  vesselTripPredictionsMutationArgs: VesselTripPredictionsMutationArgs;
  mergedApplyResult: TripLifecycleApplyOutcome;
}> => {
  const mergedApplyResult = await overlayMlOnTripLifecycleApply(
    applyTripResult,
    predictionModelAccess
  );
  const proposals = predictionRowsFromMergedApply(mergedApplyResult);
  return {
    vesselTripPredictionsMutationArgs: { proposals },
    mergedApplyResult,
  };
};

/** Full post-trip payloads for persistence (predictions table + timeline projection). */
export const materializePostTripTableWrites = async (
  applyTripResult: TripLifecycleApplyOutcome,
  predictionModelAccess: VesselTripPredictionModelAccess,
  tickStartedAt: number
): Promise<{
  vesselTripPredictionsMutationArgs: VesselTripPredictionsMutationArgs;
  timelineProjection: TimelineTickProjectionInput;
}> => {
  const { vesselTripPredictionsMutationArgs, mergedApplyResult } =
    await materializeVesselTripPredictionUpsertAndMergedBranch(
      applyTripResult,
      predictionModelAccess
    );
  const timelineProjection = buildTimelineTickProjectionInput({
    completedFacts: mergedApplyResult.completedFacts,
    currentBranch: mergedApplyResult.currentBranch,
    tickStartedAt,
  });
  return { vesselTripPredictionsMutationArgs, timelineProjection };
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
