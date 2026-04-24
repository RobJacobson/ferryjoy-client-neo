/**
 * Same-ping timeline projection from Stage C/D handoffs plus orchestrator persist
 * gates on {@link TimelineTripComputation}.
 */

import type { PredictedTripComputation } from "domain/vesselOrchestration/shared";
import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared/pingHandshake/types";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  buildTimelinePingProjectionInput,
  type TimelineProjectionAssembly,
} from "./buildTimelinePingProjectionInput";
import type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineInput,
  RunUpdateVesselTimelineOutput,
  TimelineTripComputation,
} from "./contracts";

type CompletedHandoffMatchFact = {
  tripToComplete: ConvexVesselTrip;
  scheduleTrip?: ConvexVesselTrip;
};

/**
 * Schedule identity for matching completed-handoff facts to prediction-stage
 * `PredictedTripComputation` rows. Must stay aligned with
 * {@link predictedTripComputationMatchKey} (same `ScheduleKey` then `TripKey`
 * fallbacks on completed row, then replacement active row).
 */
const scheduleIdentityForMlMergeKey = (
  completedTrip: ConvexVesselTrip | undefined,
  activeTrip: ConvexVesselTrip | undefined
): string =>
  completedTrip?.ScheduleKey ??
  completedTrip?.TripKey ??
  activeTrip?.ScheduleKey ??
  activeTrip?.TripKey ??
  "";

const timelineMlMergeKeyFromCompletedHandoffParts = (
  vesselAbbrev: string,
  completedTrip: ConvexVesselTrip | undefined,
  activeTrip: ConvexVesselTrip | undefined
): string =>
  `${vesselAbbrev}::${scheduleIdentityForMlMergeKey(completedTrip, activeTrip)}`;

const completedTripBoundaryMatchKeyFromFact = (
  fact: CompletedHandoffMatchFact
): string =>
  timelineMlMergeKeyFromCompletedHandoffParts(
    fact.tripToComplete.VesselAbbrev,
    fact.tripToComplete,
    fact.scheduleTrip
  );

const isCompletedTripBranchComputation = (
  computation: TimelineTripComputation
): computation is TimelineTripComputation & {
  branch: "completed";
} => computation.branch === "completed";

const isCurrentTripBranchComputation = (
  computation: TimelineTripComputation
): computation is TimelineTripComputation & {
  branch: "current";
} => computation.branch === "current";

const completedFactFromComputationOrThrow = (
  computation: TimelineTripComputation & { branch: "completed" }
): CompletedTripBoundaryFact => {
  if (
    computation.existingTrip === undefined ||
    computation.completedTrip === undefined ||
    computation.events === undefined
  ) {
    throw new Error(
      `[VesselTrips] completed trip computation for ${computation.vesselAbbrev} is missing required timeline fields`
    );
  }

  return {
    existingTrip: computation.existingTrip,
    tripToComplete: computation.completedTrip,
    events: computation.events,
    scheduleTrip: computation.scheduleTrip,
  };
};

const currentActualMessageFromComputation = (
  computation: TimelineTripComputation & { branch: "current" }
) => {
  if (computation.events === undefined) {
    return null;
  }

  return {
    events: computation.events,
    scheduleTrip: computation.scheduleTrip,
    vesselAbbrev: computation.vesselAbbrev,
  };
};

const currentPredictedMessageFromComputation = (
  computation: TimelineTripComputation & { branch: "current" }
) => {
  if (
    computation.events === undefined &&
    computation.existingTrip === undefined
  ) {
    return null;
  }

  return {
    existingTrip: computation.existingTrip,
    scheduleTrip: computation.scheduleTrip,
    vesselAbbrev: computation.vesselAbbrev,
  };
};

const predictedTripComputationMatchKey = (
  computation: PredictedTripComputation
): string =>
  timelineMlMergeKeyFromCompletedHandoffParts(
    computation.vesselAbbrev,
    computation.completedTrip,
    computation.activeTrip
  );

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
 * Builds projection assembly from orchestrator handoff rows (no ML overlay).
 *
 * @param tripComputations - {@link RunUpdateVesselTimelineInput.tripComputations}
 * @returns Facts and current-branch messages for timeline ping assembly
 */
export const buildTimelineProjectionAssemblyFromTripComputations = (
  tripComputations: ReadonlyArray<TimelineTripComputation>
): TimelineProjectionAssembly => {
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
 * Matching uses vessel + completed-trip schedule identity, not object identity
 * between pings.
 *
 * @param assembly - Projection assembly from {@link buildTimelineProjectionAssemblyFromTripComputations}
 * @param predictedTripComputations - ML handoff from predictions stage
 * @returns Assembly with `newTrip` / `finalProposed` fields merged from predictions
 */
export const mergePredictedComputationsIntoTimelineProjectionAssembly = (
  assembly: TimelineProjectionAssembly,
  predictedTripComputations: RunUpdateVesselTimelineInput["predictedTripComputations"]
): TimelineProjectionAssembly => {
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
    completedFacts: assembly.completedFacts.map((fact) => {
      const newTrip = mlFactsByKey.get(
        completedTripBoundaryMatchKeyFromFact(fact)
      );
      return {
        ...fact,
        newTrip,
      };
    }),
    currentBranch: {
      successfulVessels: assembly.currentBranch.successfulVessels,
      pendingActualMessages: assembly.currentBranch.pendingActualMessages.map(
        (m) => ({
          ...m,
          finalProposed: mlByVessel.get(m.vesselAbbrev),
        })
      ),
      pendingPredictedMessages:
        assembly.currentBranch.pendingPredictedMessages.map((m) => ({
          ...m,
          finalProposed: mlByVessel.get(m.vesselAbbrev),
        })),
    },
  };
};

/**
 * Timeline entrypoint for orchestrator callers that already have
 * completed/current projection assembly rows (built from trip computations or
 * persisted handoffs).
 */
export const runUpdateVesselTimelineFromAssembly = (
  input: RunUpdateVesselTimelineFromAssemblyInput
): RunUpdateVesselTimelineOutput => {
  const merged = mergePredictedComputationsIntoTimelineProjectionAssembly(
    input.projectionAssembly,
    input.predictedTripComputations
  );
  const tl = buildTimelinePingProjectionInput({
    completedFacts: merged.completedFacts,
    currentBranch: merged.currentBranch,
    pingStartedAt: input.pingStartedAt,
  });
  return {
    actualEvents: tl.actualDockWrites,
    predictedEvents: tl.predictedDockWriteBatches,
  };
};
