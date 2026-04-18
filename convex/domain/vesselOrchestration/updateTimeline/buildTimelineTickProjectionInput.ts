/**
 * Pure **updateTimeline** step: turns authoritative lifecycle outputs into
 * `TimelineTickProjectionInput` for timeline projection mutations in
 * `updateVesselOrchestrator`.
 *
 * Canonical home: `domain/vesselOrchestration/updateTimeline` (this file).
 * `functions/vesselOrchestrator/actions.ts` imports from the `updateTimeline`
 * façade so timeline assembly stays in the **updateTimeline** concern without a
 * `vesselTrips` → `vesselOrchestration` barrel cycle.
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
 * Arguments for {@link buildTimelineTickProjectionInput}.
 */
export type BuildTimelineTickProjectionInputArgs = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
  tickStartedAt: number;
};

/**
 * Merges completed-branch then current-branch tick writes for one orchestrator
 * tick. Call only **after** lifecycle mutations; `currentBranch` must be the
 * post-mutation result from the trip tick write applier (`successfulVessels` and
 * upsert-gated messages intact).
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
