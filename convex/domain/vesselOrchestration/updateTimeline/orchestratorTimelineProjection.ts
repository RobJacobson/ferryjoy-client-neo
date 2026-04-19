/**
 * Same-tick timeline projection from Stage C/D handoffs plus orchestrator persist
 * gates on {@link TimelineTripComputation}.
 */

import type { TripLifecycleApplyOutcome } from "domain/vesselOrchestration/shared";
import {
  completedFactFromComputationOrThrow,
  completedTripBoundaryMatchKeyFromFact,
  currentActualMessageFromComputation,
  currentPredictedMessageFromComputation,
  isCompletedTripBranchComputation,
  isCurrentTripBranchComputation,
} from "domain/vesselOrchestration/shared/tripComputationPersistMapping";
import type { PredictedTripComputation } from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
} from "./buildTimelineTickProjectionInput";
import type {
  RunUpdateVesselTimelineInput,
  RunUpdateVesselTimelineOutput,
  TimelineTripComputation,
} from "./contracts";
import type { TimelineTickProjectionInput } from "./tickEventWrites";
import type { CompletedTripBoundaryFact } from "./types";

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
        (
          computation
        ): computation is PredictedTripComputation & {
          branch: "completed";
          finalPredictedTrip: ConvexVesselTripWithML;
        } =>
          computation.branch === "completed" &&
          computation.finalPredictedTrip !== undefined
      )
      .map(
        (computation) =>
          [
            predictedTripComputationMatchKey(computation),
            computation.finalPredictedTrip,
          ] as const
      )
  );
  const mlByVessel = finalProposedByVesselFromPredictedComputations(
    predictedTripComputations
  );

  return {
    completedFacts: tripApplyResult.completedFacts.map((fact) => {
      const newTrip = mlFactsByKey.get(
        completedTripBoundaryMatchKeyFromFact(fact)
      );
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

const buildTripLifecycleApplyOutcomeFromTimelineComputations = (
  tripComputations: ReadonlyArray<TimelineTripComputation>
): TripLifecycleApplyOutcome => {
  const completedFacts: CompletedTripBoundaryFact[] = [];

  for (const computation of tripComputations) {
    if (isCompletedTripBranchComputation(computation)) {
      completedFacts.push(completedFactFromComputationOrThrow(computation));
    }
  }

  const currentComputations = tripComputations.filter(
    (c): c is TimelineTripComputation & { branch: "current" } =>
      isCurrentTripBranchComputation(c)
  );

  const pendingActualMessages = currentComputations.flatMap((computation) => {
    const actualMessage = currentActualMessageFromComputation(computation);
    if (actualMessage === null) {
      return [];
    }
    const requiresSuccessfulUpsert =
      computation.timelinePersist?.requiresSuccessfulUpsert ?? false;
    return [{ ...actualMessage, requiresSuccessfulUpsert }];
  });

  const pendingPredictedMessages = currentComputations.flatMap(
    (computation) => {
      const predictedMessage =
        currentPredictedMessageFromComputation(computation);
      if (predictedMessage === null) {
        return [];
      }
      const requiresSuccessfulUpsert =
        computation.timelinePersist?.requiresSuccessfulUpsert ?? false;
      return [{ ...predictedMessage, requiresSuccessfulUpsert }];
    }
  );

  const successfulVessels = new Set(
    currentComputations
      .filter((c) => c.timelinePersist?.upsertGatePassed === true)
      .map((c) => c.vesselAbbrev)
  );

  return {
    completedFacts,
    currentBranch: {
      successfulVessels,
      pendingActualMessages,
      pendingPredictedMessages,
    },
  };
};

/**
 * @deprecated Prefer {@link runUpdateVesselTimeline} with
 * {@link RunUpdateVesselTimelineInput} only, or build the lifecycle outcome from
 * {@link TimelineTripComputation} rows in the orchestrator.
 */
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
 * Canonical domain entry: handoff rows in, sparse dock rows out.
 */
export const runUpdateVesselTimeline = (
  input: RunUpdateVesselTimelineInput
): RunUpdateVesselTimelineOutput => {
  const lifecycle = buildTripLifecycleApplyOutcomeFromTimelineComputations(
    input.tripComputations
  );
  const merged = mergeTripApplyWithPredictedComputationsForTimeline(
    lifecycle,
    input.predictedTripComputations
  );
  const tl = buildTimelineTickProjectionInput({
    completedFacts: merged.completedFacts,
    currentBranch: merged.currentBranch,
    tickStartedAt: input.tickStartedAt,
  });
  return {
    actualEvents: tl.actualDockWrites,
    predictedEvents: tl.predictedDockWriteBatches,
  };
};
