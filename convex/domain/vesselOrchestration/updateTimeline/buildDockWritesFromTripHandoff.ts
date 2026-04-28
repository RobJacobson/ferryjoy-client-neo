/**
 * Pure **updateTimeline** step: merges lifecycle branch outputs into
 * {@link PingEventWrites} for one ping.
 *
 * **Production contract:** `completedTripFacts` and `currentBranch` match the
 * lifecycle-shaped rows built from Stage C/D handoffs (see
 * `updateTimeline`), with ML-enriched trips where projection
 * needs them. Same-ping assembly must not reload `vesselTripPredictions` from the
 * DB; ML overlay application runs in `updateTimeline` after
 * `updateVesselPredictions`.
 *
 * @see `functions/vesselOrchestrator/actions` — `updateVesselOrchestrator` / `updateTimeline` caller
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
 * Arguments for {@link buildDockWritesFromTripHandoff}.
 */
export type BuildDockWritesFromTripHandoffArgs =
  PersistedTripTimelineHandoff & {
    pingStartedAt: number;
  };

/**
 * Merges completed-branch then current-branch ping writes for one orchestrator
 * ping. For timeline rows that need ML (e.g. predicted dock batches), call only
 * after ML overlay application in `updateTimeline`; `currentBranch` must still reflect
 * post-mutation upsert gating
 * (`successfulVesselAbbrev`, pending writes).
 *
 * @param args - Boundary facts, current-branch artifacts, and ping time
 * @returns Sparse timeline payload for orchestrator timeline mutations
 */
export const buildDockWritesFromTripHandoff = (
  args: BuildDockWritesFromTripHandoffArgs
): PingEventWrites => {
  const { completedTripFacts, currentBranch, pingStartedAt } = args;
  return mergePingEventWrites(
    buildPingEventWritesFromCompletedFacts(completedTripFacts, pingStartedAt),
    buildPingEventWritesFromCurrentMessages(
      currentBranch.successfulVesselAbbrev,
      currentBranch.pendingActualWrite,
      currentBranch.pendingPredictedWrite,
      pingStartedAt
    )
  );
};
