/**
 * Pure **updateTimeline** step: merges lifecycle branch outputs into
 * `TimelineTickProjectionInput` for one tick.
 *
 * **Production contract:** `completedFacts` and `currentBranch` match the
 * lifecycle-shaped rows built from Stage C/D handoffs (see
 * `orchestratorTimelineProjection`), with ML-enriched trips where projection
 * needs them. Same-tick assembly must not reload `vesselTripPredictions` from the
 * DB; ML overlay uses {@link mergePredictedComputationsIntoTimelineProjectionAssembly}
 * in `orchestratorTimelineProjection` after `runUpdateVesselPredictions`.
 *
 * @see `functions/vesselOrchestrator/actions` — `updateVesselTimeline` caller
 *
 * Canonical home: `domain/vesselOrchestration/updateTimeline` (this file).
 */

import {
  mergeTickEventWrites,
  type TimelineTickProjectionInput,
} from "./tickEventWrites";
import {
  buildTickEventWritesFromCompletedFacts,
  buildTickEventWritesFromCurrentMessages,
} from "./timelineEventAssembler";
import type {
  CompletedTripBoundaryFact,
  CurrentTripLifecycleBranchResult,
} from "./types";

/**
 * Facts and current-branch state for one tick after ML overlay from prediction
 * handoffs (same shapes as {@link BuildTimelineTickProjectionInputArgs} minus tick
 * time).
 */
export type TimelineProjectionAssembly = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
};

/**
 * Arguments for {@link buildTimelineTickProjectionInput}.
 */
export type BuildTimelineTickProjectionInputArgs =
  TimelineProjectionAssembly & {
    tickStartedAt: number;
  };

/**
 * Merges completed-branch then current-branch tick writes for one orchestrator
 * tick. For timeline rows that need ML (e.g. predicted dock batches), call only
 * after {@link mergePredictedComputationsIntoTimelineProjectionAssembly} in
 * `orchestratorTimelineProjection`; `currentBranch` must still reflect
 * post-mutation upsert gating
 * (`successfulVessels`, pending messages).
 *
 * @param args - Boundary facts, current-branch artifacts, and tick time
 * @returns Sparse timeline payload for orchestrator timeline mutations
 */
export const buildTimelineTickProjectionInput = (
  args: BuildTimelineTickProjectionInputArgs
): TimelineTickProjectionInput => {
  const { completedFacts, currentBranch, tickStartedAt } = args;
  return mergeTickEventWrites(
    buildTickEventWritesFromCompletedFacts(completedFacts, tickStartedAt),
    buildTickEventWritesFromCurrentMessages(
      currentBranch.successfulVessels,
      currentBranch.pendingActualMessages,
      currentBranch.pendingPredictedMessages,
      tickStartedAt
    )
  );
};
