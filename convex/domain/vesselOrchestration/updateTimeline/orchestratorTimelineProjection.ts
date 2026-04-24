/**
 * Same-ping timeline projection from Stage C/D handoffs.
 */

import type { PredictedTripComputation } from "domain/vesselOrchestration/shared";
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
  RunUpdateVesselTimelineOutput,
} from "./contracts";

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

const predictedTripComputationMatchKey = (
  computation: PredictedTripComputation
): string =>
  timelineMlMergeKeyFromCompletedHandoffParts(
    computation.vesselAbbrev,
    computation.completedTrip,
    computation.activeTrip
  );

const finalProposedByVesselFromPredictedComputations = (
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>
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
 * between pings.
 *
 * @param assembly - Projection assembly from trip persistence output
 * @param predictedTripComputations - ML handoff from predictions stage
 * @returns Assembly with `newTrip` / `finalProposed` fields merged from predictions
 */
export const mergePredictedComputationsIntoTimelineProjectionAssembly = (
  assembly: TimelineProjectionAssembly,
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>
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
        timelineMlMergeKeyFromCompletedHandoffParts(
          fact.tripToComplete.VesselAbbrev,
          fact.tripToComplete,
          fact.scheduleTrip
        )
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
 * completed/current projection assembly rows.
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
