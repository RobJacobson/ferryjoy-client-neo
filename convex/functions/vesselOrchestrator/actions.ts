/**
 * Vessel orchestrator actions.
 */

import { internalAction } from "_generated/server";
import { v } from "convex/values";
import { runOrchestratorPing } from "./pipeline/runOrchestratorPing";

/**
 * Runs one orchestrator tick from location ingest through per-vessel writes.
 *
 * This is the orchestrator module's public action boundary and the only place
 * that coordinates cross-module sequencing for a live ping. It exists to keep
 * domain logic pure while centralizing side-effect ordering across
 * `pipeline/*`, `functions/vesselLocation/mutations`, and
 * `functions/vesselOrchestrator/mutations`. The handler delegates most compute to domain
 * functions, but intentionally owns failure semantics and stage order so trip,
 * prediction, and timeline writes stay causally aligned for the same vessel
 * update.
 *
 * @param ctx - Convex action context for reads, mutations, and logging
 * @returns `null` after processing completes
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    try {
      await runOrchestratorPing(ctx);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
    return null;
  },
});
