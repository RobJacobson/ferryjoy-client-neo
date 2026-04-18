/**
 * Merges ML onto trip lifecycle outputs after DB writes: runs
 * `applyVesselPredictions` per carried {@link BuildTripCoreResult}, persists
 * proposals, and returns timeline-ready {@link ApplyVesselTripTickWritePlanResult}.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "domain/vesselOrchestration/updateTimeline";
import {
  applyVesselPredictions,
  vesselTripPredictionProposalsFromMlTrip,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ApplyVesselTripTickWritePlanResult } from "functions/vesselTrips/applyVesselTripTickWritePlan";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";

/**
 * Runs ML attachment and `vesselTripPredictions` upserts after trip mutations.
 *
 * **Ordering:** `applyVesselPredictions` and in-memory merge complete before this
 * function returns, so {@link buildTimelineTickProjectionInput} sees ML-shaped
 * trips. `batchUpsertProposals` runs after merge; timeline reads in-memory trips,
 * not a same-tick reload from `vesselTripPredictions`.
 *
 * @param ctx - Convex action context
 * @param applyTripResult - Post-mutation lifecycle branch state (carries cores on facts/messages)
 * @param predictionModelAccess - Production ML model reads for this tick
 * @returns Copy of `applyTripResult` with ML merged for timeline assembly
 */
export const enrichTripApplyResultWithPredictions = async (
  ctx: ActionCtx,
  applyTripResult: ApplyVesselTripTickWritePlanResult,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<ApplyVesselTripTickWritePlanResult> => {
  const completedFacts = await enrichCompletedFacts(
    applyTripResult.completedFacts,
    predictionModelAccess
  );

  const { actual, predicted, mlByVessel } = await enrichCurrentTripMessages(
    applyTripResult.currentBranch.pendingActualMessages,
    applyTripResult.currentBranch.pendingPredictedMessages,
    predictionModelAccess
  );

  const currentMlTrips: ConvexVesselTripWithML[] = [...mlByVessel.values()];

  const proposals = collectAllProposals(completedFacts, currentMlTrips);

  // Persist after merge; timeline below uses in-memory ML trips only.
  if (proposals.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselTripPredictions.mutations.batchUpsertProposals,
      { proposals }
    );
  }

  return {
    completedFacts,
    currentBranch: {
      successfulVessels: applyTripResult.currentBranch.successfulVessels,
      pendingActualMessages: actual,
      pendingPredictedMessages: predicted,
    },
  };
};

/**
 * Attaches ML to completed-boundary replacement rows (fail-fast per fact).
 *
 * @param facts - Successful handoff facts from the applier
 * @param predictionModelAccess - ML model reads
 * @returns Facts with `newTrip` populated for timeline predicted batches
 */
const enrichCompletedFacts = async (
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

/**
 * Deduplicates ML work per `vesselAbbrev` on the current branch (actual + predicted
 * messages share one `tripCore` per vessel per tick).
 *
 * @param pendingActualMessages - Upsert-gated actual dock intents
 * @param pendingPredictedMessages - Predicted overlay intents
 * @param predictionModelAccess - ML model reads
 * @returns Messages with `finalProposed` set and a map of ML trips by vessel
 */
const enrichCurrentTripMessages = async (
  pendingActualMessages: CurrentTripActualEventMessage[],
  pendingPredictedMessages: CurrentTripPredictedEventMessage[],
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<{
  actual: CurrentTripActualEventMessage[];
  predicted: CurrentTripPredictedEventMessage[];
  mlByVessel: Map<string, ConvexVesselTripWithML>;
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

  const attach = (finalProposed: ConvexVesselTripWithML | undefined) => {
    if (finalProposed === undefined) {
      throw new Error("Missing ML merge for current-trip message");
    }
    return finalProposed;
  };

  return {
    actual: pendingActualMessages.map((m) => ({
      ...m,
      finalProposed: attach(mlByVessel.get(m.vesselAbbrev)),
    })),
    predicted: pendingPredictedMessages.map((m) => ({
      ...m,
      finalProposed: attach(mlByVessel.get(m.vesselAbbrev)),
    })),
    mlByVessel,
  };
};

/**
 * Flattens proposal rows for every ML trip produced this tick.
 *
 * @param completedFacts - Handoff facts after ML merge
 * @param currentMlTrips - ML trips from the active branch (deduped per vessel)
 * @returns All proposals for `batchUpsertProposals`
 */
const collectAllProposals = (
  completedFacts: CompletedTripBoundaryFact[],
  currentMlTrips: ConvexVesselTripWithML[]
): VesselTripPredictionProposal[] => {
  const fromCompleted = completedFacts.flatMap((f) =>
    f.newTrip !== undefined
      ? vesselTripPredictionProposalsFromMlTrip(f.newTrip)
      : []
  );
  const fromCurrent = currentMlTrips.flatMap((t) =>
    vesselTripPredictionProposalsFromMlTrip(t)
  );
  return [...fromCompleted, ...fromCurrent];
};
