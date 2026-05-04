/**
 * Pure **updateEvents** step: merges lifecycle branch outputs into
 * {@link PingEventWrites} for one ping.
 *
 * **Production contract:** `completedTripFacts` and `currentBranch` match the
 * lifecycle-shaped rows built from Stage C/D handoffs (see
 * `updateEvents`), with ML-enriched trips where projection
 * needs them. Same-ping assembly consumes the enriched trip directly; ML
 * overlay application runs in `updateEvents` after
 * `getVesselTripPredictionsFromTripUpdate`.
 *
 * @see `functions/vesselOrchestrator/actions` — `updateVesselOrchestrator` / `updateEvents` caller
 *
 * Canonical home: `domain/vesselOrchestration/updateEvents` (this file).
 */

import {
  buildPingEventWritesFromCompletedFacts,
  buildPingEventWritesFromCurrentMessages,
} from "./eventWriteAssembler";
import type { PersistedTripEventHandoff } from "./handoffTypes";
import { mergePingEventWrites, type PingEventWrites } from "./projectionWire";

/**
 * Arguments for {@link buildDockWritesFromTripHandoff}.
 */
export type BuildDockWritesFromTripHandoffArgs = PersistedTripEventHandoff & {
  pingStartedAt: number;
};

/**
 * Merges completed-branch then current-branch ping writes for one orchestrator
 * ping. For event rows that need ML (e.g. predicted dock batches), call only
 * after ML overlay application in `updateEvents`; `currentBranch` must still reflect
 * post-mutation upsert gating
 * (`successfulVesselAbbrev`, pending writes).
 *
 * @param args - Boundary facts, current-branch artifacts, and ping time
 * @returns Sparse event payload for orchestrator event mutations
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
