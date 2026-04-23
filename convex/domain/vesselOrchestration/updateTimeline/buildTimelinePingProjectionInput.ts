/**
 * Pure **updateTimeline** step: merges lifecycle branch outputs into
 * `TimelinePingProjectionInput` for one ping.
 *
 * **Production contract:** `completedFacts` and `currentBranch` match the
 * lifecycle-shaped rows built from Stage C/D handoffs (see
 * `orchestratorTimelineProjection`), with ML-enriched trips where projection
 * needs them. Same-ping assembly must not reload `vesselTripPredictions` from the
 * DB; ML overlay uses {@link mergePredictedComputationsIntoTimelineProjectionAssembly}
 * in `orchestratorTimelineProjection` after `runVesselPredictionPing`.
 *
 * @see `functions/vesselOrchestrator/actions` — `updateVesselTimeline` caller
 *
 * Canonical home: `domain/vesselOrchestration/updateTimeline` (this file).
 */

import {
  mergePingEventWrites,
  type TimelinePingProjectionInput,
} from "domain/vesselOrchestration/shared/pingHandshake/projectionWire";
import type {
  CompletedTripBoundaryFact,
  CurrentTripLifecycleBranchResult,
} from "domain/vesselOrchestration/shared/pingHandshake/types";
import {
  buildPingEventWritesFromCompletedFacts,
  buildPingEventWritesFromCurrentMessages,
} from "./timelineEventAssembler";

/**
 * Facts and current-branch state for one ping after ML overlay from prediction
 * handoffs (same shapes as {@link BuildTimelinePingProjectionInputArgs} minus ping
 * time).
 */
export type TimelineProjectionAssembly = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
};

/**
 * Arguments for {@link buildTimelinePingProjectionInput}.
 */
export type BuildTimelinePingProjectionInputArgs =
  TimelineProjectionAssembly & {
    pingStartedAt: number;
  };

/**
 * Merges completed-branch then current-branch ping writes for one orchestrator
 * ping. For timeline rows that need ML (e.g. predicted dock batches), call only
 * after {@link mergePredictedComputationsIntoTimelineProjectionAssembly} in
 * `orchestratorTimelineProjection`; `currentBranch` must still reflect
 * post-mutation upsert gating
 * (`successfulVessels`, pending messages).
 *
 * @param args - Boundary facts, current-branch artifacts, and ping time
 * @returns Sparse timeline payload for orchestrator timeline mutations
 */
export const buildTimelinePingProjectionInput = (
  args: BuildTimelinePingProjectionInputArgs
): TimelinePingProjectionInput => {
  const { completedFacts, currentBranch, pingStartedAt } = args;
  return mergePingEventWrites(
    buildPingEventWritesFromCompletedFacts(completedFacts, pingStartedAt),
    buildPingEventWritesFromCurrentMessages(
      currentBranch.successfulVessels,
      currentBranch.pendingActualMessages,
      currentBranch.pendingPredictedMessages,
      pingStartedAt
    )
  );
};
