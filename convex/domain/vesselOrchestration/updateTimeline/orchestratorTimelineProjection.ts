/**
 * Persist-gated same-tick timeline projection. Stage D keeps the bridge from
 * canonical prediction outputs into the transitional timeline handshake private
 * to this module.
 */

import type { PredictedTripComputation } from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
} from "./buildTimelineTickProjectionInput";
import type { RunUpdateVesselTimelineInput } from "./contracts";
import type { TimelineTickProjectionInput } from "./tickEventWrites";
import type {
  CompletedTripBoundaryFact,
  TripLifecycleApplyOutcome,
} from "./types";

const completedBoundaryMatchKey = (fact: CompletedTripBoundaryFact) =>
  `${fact.tripToComplete.VesselAbbrev}::${fact.tripToComplete.ScheduleKey}`;

const predictedTripComputationMatchKey = (
  computation: PredictedTripComputation
) =>
  `${computation.vesselAbbrev}::${computation.completedTrip?.ScheduleKey ?? computation.completedTrip?.TripKey ?? computation.activeTrip?.ScheduleKey ?? computation.activeTrip?.TripKey ?? ""}`;

const finalProposedByVesselFromPredictedComputations = (
  predictedTripComputations: RunUpdateVesselTimelineInput["predictedTripComputations"]
): Map<string, ConvexVesselTripWithML> => {
  const map = new Map<string, ConvexVesselTripWithML>();
  for (const computation of predictedTripComputations) {
    if (
      computation.branch === "current" &&
      computation.finalPredictedTrip !== undefined
    ) {
      map.set(computation.vesselAbbrev, computation.finalPredictedTrip);
    }
  }
  return map;
};

/**
 * Matching uses vessel + completed-trip schedule identity, not object identity
 * between ticks.
 */
export const mergeTripApplyWithPredictedComputationsForTimeline = (
  tripApplyResult: TripLifecycleApplyOutcome,
  predictedTripComputations: RunUpdateVesselTimelineInput["predictedTripComputations"]
): TripLifecycleApplyOutcome => {
  const mlFactsByKey = new Map(
    predictedTripComputations
      .filter(
        (computation): computation is PredictedTripComputation & {
          branch: "completed";
          finalPredictedTrip: ConvexVesselTripWithML;
        } =>
          computation.branch === "completed" &&
          computation.finalPredictedTrip !== undefined
      )
      .map((computation) => [
        predictedTripComputationMatchKey(computation),
        computation.finalPredictedTrip,
      ] as const)
  );
  const mlByVessel =
    finalProposedByVesselFromPredictedComputations(predictedTripComputations);

  return {
    completedFacts: tripApplyResult.completedFacts.map((fact) => {
      const newTrip = mlFactsByKey.get(completedBoundaryMatchKey(fact));
      return {
        ...fact,
        newTrip,
      };
    }),
    currentBranch: {
      successfulVessels: tripApplyResult.currentBranch.successfulVessels,
      pendingActualMessages:
        tripApplyResult.currentBranch.pendingActualMessages.map((m) => ({
          ...m,
          finalProposed: mlByVessel.get(m.vesselAbbrev),
        })),
      pendingPredictedMessages:
        tripApplyResult.currentBranch.pendingPredictedMessages.map((m) => ({
          ...m,
          finalProposed: mlByVessel.get(m.vesselAbbrev),
        })),
    },
  };
};

export const mergeTripApplyWithMlForTimeline =
  mergeTripApplyWithPredictedComputationsForTimeline;

export const buildOrchestratorTimelineProjectionInput = (
  tripApplyResult: TripLifecycleApplyOutcome,
  input: RunUpdateVesselTimelineInput,
  tickStartedAt: number
): TimelineTickProjectionInput => {
  const merged = mergeTripApplyWithPredictedComputationsForTimeline(
    tripApplyResult,
    input.predictedTripComputations
  );
  const args: BuildTimelineTickProjectionInputArgs = {
    completedFacts: merged.completedFacts,
    currentBranch: merged.currentBranch,
    tickStartedAt,
  };
  return buildTimelineTickProjectionInput(args);
};

/**
 * Pure prelude to the `updateVesselTimeline` action in `functions/vesselOrchestrator/actions.ts`.
 */
export const runUpdateVesselTimeline = (
  tripApplyResult: TripLifecycleApplyOutcome,
  input: RunUpdateVesselTimelineInput,
  tickStartedAt: number
): {
  actual: { Writes: TimelineTickProjectionInput["actualDockWrites"] };
  predicted: {
    Batches: TimelineTickProjectionInput["predictedDockWriteBatches"];
  };
} => {
  const tl = buildOrchestratorTimelineProjectionInput(
    tripApplyResult,
    input,
    tickStartedAt
  );
  return {
    actual: { Writes: tl.actualDockWrites },
    predicted: { Batches: tl.predictedDockWriteBatches },
  };
};
