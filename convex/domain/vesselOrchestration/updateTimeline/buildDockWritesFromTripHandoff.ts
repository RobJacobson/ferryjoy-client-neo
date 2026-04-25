/**
 * Pure **updateTimeline** step: merges lifecycle branch outputs into
 * {@link PingEventWrites} for one ping.
 *
 * **Production contract:** `completedFacts` and `currentBranch` match the
 * lifecycle-shaped rows built from Stage C/D handoffs (see
 * `orchestratorTimelineProjection`), with ML-enriched trips where projection
 * needs them. Same-ping assembly must not reload `vesselTripPredictions` from the
 * DB; ML overlay uses {@link mergeMlOverlayIntoTripHandoffForTimeline}
 * in `orchestratorTimelineProjection` after `runVesselPredictionPing`.
 *
 * @see `functions/vesselOrchestrator/actions` — `updateVesselTimeline` caller
 *
 * Canonical home: `domain/vesselOrchestration/updateTimeline` (this file).
 */

import {
  mergePingEventWrites,
  type PingEventWrites,
} from "domain/vesselOrchestration/shared/pingHandshake/projectionWire";
import type { PersistedTripTimelineHandoff } from "domain/vesselOrchestration/shared/pingHandshake/types";
import {
  buildPingEventWritesFromCompletedFacts,
  buildPingEventWritesFromCurrentMessages,
} from "./timelineEventAssembler";

/**
 * Trip persistence output plus current-branch state for one ping, after ML
 * overlay from prediction handoffs (same shapes as {@link BuildDockWritesFromTripHandoffArgs} minus ping
 * time).
 */
export type TripHandoffForTimeline = PersistedTripTimelineHandoff;

/**
 * Arguments for {@link buildDockWritesFromTripHandoff}.
 */
export type BuildDockWritesFromTripHandoffArgs = TripHandoffForTimeline & {
  pingStartedAt: number;
};

/**
 * Merges completed-branch then current-branch ping writes for one orchestrator
 * ping. For timeline rows that need ML (e.g. predicted dock batches), call only
 * after {@link mergeMlOverlayIntoTripHandoffForTimeline} in
 * `orchestratorTimelineProjection`; `currentBranch` must still reflect
 * post-mutation upsert gating
 * (`successfulVessels`, pending messages).
 *
 * @param args - Boundary facts, current-branch artifacts, and ping time
 * @returns Sparse timeline payload for orchestrator timeline mutations
 */
export const buildDockWritesFromTripHandoff = (
  args: BuildDockWritesFromTripHandoffArgs
): PingEventWrites => {
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
