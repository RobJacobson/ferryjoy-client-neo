/**
 * Top-level real-time vessel orchestrator.
 *
 * Fetches one batch of WSF vessel locations, converts it into backend-owned
 * identity, then runs {@link executeVesselOrchestratorTick} so the same batch
 * feeds location storage and trip/timeline processing.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters";
import { getPassengerTerminalAbbrevs } from "domain/vesselOrchestration";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { executeVesselOrchestratorTick } from "./executeVesselOrchestratorTick";
import type { VesselOrchestratorTickResult } from "./types";

/**
 * Orchestrator action that fetches vessel locations once and runs
 * {@link executeVesselOrchestratorTick} with robust error isolation between
 * branches.
 *
 * This action eliminates duplicate API calls by fetching vessel locations once,
 * then passing the same converted data to both processing paths. Failures in
 * one branch do not prevent the other from executing.
 *
 * Four concerns (`architecture.md` §10), implemented in
 * {@link executeVesselOrchestratorTick}:
 * - **updateVesselLocations** — `runUpdateVesselLocationsTick` → `bulkUpsert`
 * - **updateVesselTrips** — `runProcessVesselTripsTick` with default trip deps
 *   (**updateVesselPredictions** is `applyVesselPredictions` after `buildTripCore`
 *   inside the trip pipeline, not a separate orchestrator hop)
 * - **updateTimeline** — `applyTickEventWrites` with `tripResult.tickEventWrites`
 *
 * Flow:
 * 1. Load vessels, terminals, and active trips in one internal query (soft-fail
 *    this tick if identity tables are empty — no inline sync)
 * 2. Fetch `ConvexVesselLocation` rows via {@link fetchWsfVesselLocations} (WSF
 *    adapter plus identity maps)
 * 3. Derive passenger terminal abbrevs and capture one tick timestamp
 * 4. Run {@link executeVesselOrchestratorTick} with that payload (locations
 *    branch vs trip branch: **updateVesselTrips** then **updateTimeline**)
 *
 * @param ctx - Convex action context
 * @returns {@link VesselOrchestratorTickResult}; throws if read model, WSF
 *   fetch, or post-fetch orchestrator tick fails
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (ctx): Promise<VesselOrchestratorTickResult> => {
    const readModel = await loadOrchestratorTickReadModel(ctx);
    if (readModel === undefined) {
      throw new Error(
        "vesselsIdentity or terminalsIdentity empty; skipping tick."
      );
    }

    const { vesselsIdentity, terminalsIdentity, activeTrips } = readModel;
    const convexLocations = await fetchWsfVesselLocations(
      vesselsIdentity,
      terminalsIdentity
    );
    const passengerTerminalAbbrevs =
      getPassengerTerminalAbbrevs(terminalsIdentity);
    const tickStartedAt = Date.now();

    return executeVesselOrchestratorTick(ctx, {
      convexLocations,
      passengerTerminalAbbrevs,
      tickStartedAt,
      activeTrips,
    });
  },
});

/** Snapshot from {@link getOrchestratorModelData} when identity rows exist. */
type OrchestratorTickReadModel = {
  vesselsIdentity: VesselIdentity[];
  terminalsIdentity: TerminalIdentity[];
  activeTrips: TickActiveTrip[];
};

/**
 * Load orchestrator DB snapshots in one query. Does not sync identity tables;
 * hourly crons and deploy seed populate them.
 *
 * @param ctx - Convex action context
 * @returns Loaded model, or `undefined` if either identity table is empty
 */
async function loadOrchestratorTickReadModel(
  ctx: ActionCtx
): Promise<OrchestratorTickReadModel | undefined> {
  // Single internal query: vesselsIdentity, terminalsIdentity, activeTrips (one
  // round trip; actions cannot read the DB directly).
  const readModelRef =
    internal.functions.vesselOrchestrator.queries.getOrchestratorModelData;

  const snapshot = await ctx.runQuery(readModelRef);

  if (
    snapshot.vesselsIdentity.length === 0 ||
    snapshot.terminalsIdentity.length === 0
  ) {
    return undefined;
  }

  return {
    vesselsIdentity: snapshot.vesselsIdentity,
    terminalsIdentity: snapshot.terminalsIdentity,
    activeTrips: snapshot.activeTrips,
  };
}
