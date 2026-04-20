/**
 * Same-tick timeline projection from Stage C/D handoffs plus orchestrator persist
 * gates on {@link TimelineTripComputation}.
 */

import type { PredictedTripComputation } from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import {
  buildTimelineTickProjectionInput,
  type TimelineProjectionAssembly,
} from "./buildTimelineTickProjectionInput";
import type {
  RunUpdateVesselTimelineInput,
  RunUpdateVesselTimelineOutput,
  TimelineTripComputation,
} from "./contracts";
import type { CompletedTripBoundaryFact } from "./types";

const completedTripBoundaryMatchKeyFromFact = (
  fact: Pick<CompletedTripBoundaryFact, "tripToComplete">
): string =>
  `${fact.tripToComplete.VesselAbbrev}::${fact.tripToComplete.ScheduleKey}`;

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
    newTripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
    },
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
    tripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
    },
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
    tripCore: {
      withFinalSchedule: computation.tripCore.withFinalSchedule,
    },
    vesselAbbrev: computation.vesselAbbrev,
  };
};

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
 * Builds projection assembly from orchestrator handoff rows (no ML overlay).
 *
 * @param tripComputations - {@link RunUpdateVesselTimelineInput.tripComputations}
 * @returns Facts and current-branch messages for timeline tick assembly
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
 * between ticks.
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
 * Canonical domain entry: handoff rows in, sparse dock rows out.
 */
export const runUpdateVesselTimeline = (
  input: RunUpdateVesselTimelineInput
): RunUpdateVesselTimelineOutput => {
  const assembly = buildTimelineProjectionAssemblyFromTripComputations(
    input.tripComputations
  );
  const merged = mergePredictedComputationsIntoTimelineProjectionAssembly(
    assembly,
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
