/**
 * Persist-gated lifecycle outcome + ML overlay merge for same-tick timeline projection.
 */

import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
} from "./buildTimelineTickProjectionInput";
import type { TimelineTickProjectionInput } from "./tickEventWrites";
import type {
  CompletedTripBoundaryFact,
  TripLifecycleApplyOutcome,
} from "./types";

const completedBoundaryMatchKey = (fact: CompletedTripBoundaryFact) =>
  `${fact.tripToComplete.VesselAbbrev}::${fact.tripToComplete.ScheduleKey}`;

const finalProposedByVesselFromMlBranch = (
  ml: TripLifecycleApplyOutcome
): Map<string, ConvexVesselTripWithML> => {
  const map = new Map<string, ConvexVesselTripWithML>();
  for (const m of [
    ...ml.currentBranch.pendingActualMessages,
    ...ml.currentBranch.pendingPredictedMessages,
  ]) {
    if (m.finalProposed !== undefined) {
      map.set(m.vesselAbbrev, m.finalProposed);
    }
  }
  return map;
};

/**
 * Matching uses vessel + completed-trip schedule key, not object identity between ticks.
 */
export const mergeTripApplyWithMlForTimeline = (
  tripApplyResult: TripLifecycleApplyOutcome,
  mlFull: TripLifecycleApplyOutcome
): TripLifecycleApplyOutcome => {
  const mlFactsByKey = new Map(
    mlFull.completedFacts.map((f) => [completedBoundaryMatchKey(f), f] as const)
  );
  const mlByVessel = finalProposedByVesselFromMlBranch(mlFull);

  return {
    completedFacts: tripApplyResult.completedFacts.map((fact) => {
      const mlFact = mlFactsByKey.get(completedBoundaryMatchKey(fact));
      return {
        ...fact,
        newTrip: mlFact?.newTrip,
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

export const buildOrchestratorTimelineProjectionInput = (
  tripApplyResult: TripLifecycleApplyOutcome,
  mlFull: TripLifecycleApplyOutcome,
  tickStartedAt: number
): TimelineTickProjectionInput => {
  const merged = mergeTripApplyWithMlForTimeline(tripApplyResult, mlFull);
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
  mlFull: TripLifecycleApplyOutcome,
  tickStartedAt: number
): {
  actual: { Writes: TimelineTickProjectionInput["actualDockWrites"] };
  predicted: {
    Batches: TimelineTickProjectionInput["predictedDockWriteBatches"];
  };
} => {
  const tl = buildOrchestratorTimelineProjectionInput(
    tripApplyResult,
    mlFull,
    tickStartedAt
  );
  return {
    actual: { Writes: tl.actualDockWrites },
    predicted: { Batches: tl.predictedDockWriteBatches },
  };
};
