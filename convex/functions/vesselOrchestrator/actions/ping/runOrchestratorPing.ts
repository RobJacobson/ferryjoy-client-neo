/**
 * Vessel orchestrator ping runner: one WSF batch through locations, then
 * per-vessel VesselUpdatePlan compute and atomic persistence.
 *
 * The hot path keeps one identities snapshot query, one WSF fetch, a
 * per-vessel trip loop over changed locations only, one locations mutation
 * (includes post-write active-trip reads for changed vessels), and one atomic
 * persistence mutation per vessel that produces a non-null plan.
 *
 * The public Convex action entry is `updateVesselOrchestrator` in
 * `../updateVesselOrchestrator.ts`.
 */

import type { ActionCtx } from "_generated/server";
import {
  computeVesselUpdatePlan,
  createUpdateVesselTripDbAccess,
  persistVesselUpdatePlan,
} from "./computeVesselUpdatePlan";
import { loadOrchestratorSnapshot } from "./loadSnapshot";
import { runUpdateVesselLocations } from "./updateVesselLocations";

/**
 * Executes one ping pipeline after the action shell handles top-level errors.
 *
 * This internal runner preserves the invariant that one WSF batch drives one
 * consistent orchestrator pass. It loads identities, runs location
 * normalization/dedupe; active trips for changed vessels are loaded inside
 * `bulkUpsertVesselLocations` (same transaction as location writes),
 * then executes per-vessel plan compute and persistence. Keeping this flow in one
 * function makes control-flow intent explicit while keeping domain details
 * encapsulated in `domain/vesselOrchestration/*` and the persistence
 * mutation boundary.
 *
 * @param ctx - Convex action context used throughout the ping
 * @returns Resolves when this ping has processed all changed vessels
 */
export const runOrchestratorPing = async (ctx: ActionCtx): Promise<void> => {
  const snapshot = await loadOrchestratorSnapshot(ctx);
  const pingStartedAt = Date.now();

  const {
    changedLocations: dedupedLocationUpdates,
    activeTripsByVesselAbbrev,
  } = await runUpdateVesselLocations(ctx, {
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });

  const tripDbAccess = createUpdateVesselTripDbAccess(ctx);

  for (const vesselLocation of dedupedLocationUpdates) {
    try {
      const plan = await computeVesselUpdatePlan(ctx, {
        pingStartedAt,
        vesselLocation,
        existingActiveTrip: activeTripsByVesselAbbrev.get(
          vesselLocation.VesselAbbrev
        ),
        tripDbAccess,
      });

      if (plan === null) {
        continue;
      }

      await persistVesselUpdatePlan(ctx, plan);
    } catch (error) {
      // Log and continue so one vessel failure does not block other vessel branches.
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator] per-vessel pipeline failed", {
        vesselAbbrev: vesselLocation.VesselAbbrev,
        message: err.message,
        stack: err.stack,
      });
    }
  }
};
