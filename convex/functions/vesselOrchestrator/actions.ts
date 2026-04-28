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
 * that coordinates cross-module sequencing for a live ping.
 *
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
