/**
 * Pure **updateTimeline** step: merges lifecycle branch outputs into
 * `TimelineTickProjectionInput` for one tick.
 *
 * **Production contract:** `completedFacts` and `currentBranch` are the slices of
 * `ApplyVesselTripTickWritePlanResult` that `updateVesselTimeline` passes after
 * `updateVesselPredictions`, with ML-enriched trips where projection needs them.
 * Same-tick assembly must not reload `vesselTripPredictions` from the DB; see
 * `enrichTripApplyResultWithPredictions` for ordering and in-memory merge.
 *
 * @see `functions/vesselOrchestrator/enrichTripApplyResultWithPredictions` — merge ordering
 * @see `functions/vesselOrchestrator/orchestratorPipelines` — `updateVesselTimeline` caller
 *
 * Canonical home: `domain/vesselOrchestration/updateTimeline` (this file). Imported
 * via the `updateTimeline` façade from `orchestratorPipelines` (not through the
 * `vesselTrips` barrel) to avoid cycles.
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
 * Arguments for {@link buildTimelineTickProjectionInput}. In production these
 * fields mirror `ApplyVesselTripTickWritePlanResult` after predictions merge.
 */
export type BuildTimelineTickProjectionInputArgs = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
  tickStartedAt: number;
};

/**
 * Merges completed-branch then current-branch tick writes for one orchestrator
 * tick. For timeline rows that need ML (e.g. predicted dock batches), call only
 * after `enrichTripApplyResultWithPredictions` has merged onto the apply result;
 * `currentBranch` must still reflect post-mutation upsert gating
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
