/**
 * Pure **updateTimeline** step: merges lifecycle branch outputs into
 * `TimelineTickProjectionInput` for one tick.
 *
 * **Production contract:** `completedFacts` and `currentBranch` are the slices of
 * `TripLifecycleApplyOutcome` that `updateVesselTimeline` passes after
 * `updateVesselPredictions`, with ML-enriched trips where projection needs them.
 * Same-tick assembly must not reload `vesselTripPredictions` from the DB; merge
 * ordering uses `mergeTripApplyWithMlForTimeline` in `updateTimeline`
 * after `runUpdateVesselPredictions`.
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
 * Arguments for {@link buildTimelineTickProjectionInput}. In production these
 * fields mirror `TripLifecycleApplyOutcome` after predictions merge.
 */
export type BuildTimelineTickProjectionInputArgs = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
  tickStartedAt: number;
};

/**
 * Merges completed-branch then current-branch tick writes for one orchestrator
 * tick. For timeline rows that need ML (e.g. predicted dock batches), call only
 * after `mergeTripApplyWithMlForTimeline` has merged ML onto the apply result;
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
