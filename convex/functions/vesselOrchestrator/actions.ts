/**
 * Top-level real-time vessel orchestrator.
 *
 * Fetches one batch of WSF vessel locations, converts it into backend-owned
 * identity, then fans that same batch out to location storage and trip/timeline
 * processing.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters";
import {
  getPassengerTerminalAbbrevs,
  runVesselOrchestratorTick,
  type VesselOrchestratorTickResult,
} from "domain/vesselOrchestration";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { createVesselOrchestratorTickDeps } from "./createVesselOrchestratorTickDeps";

/**
 * Orchestrator action that fetches vessel locations once and fans out to domain
 * tick processing with robust error isolation.
 *
 * This action eliminates duplicate API calls by fetching vessel locations once,
 * then passing the same converted data to both processing functions. Failures
 * in one function do not prevent the other from executing.
 *
 * Four concerns (`architecture.md` §10), wired into `runVesselOrchestratorTick`
 * via {@link createVesselOrchestratorTickDeps}:
 * - **updateVesselLocations** — `runUpdateVesselLocationsTick` → `bulkUpsert`
 * - **updateVesselTrips** — `processVesselTripsWithDeps` with default trip deps
 *   (**updateVesselPredictions** is `applyVesselPredictions` after `buildTripCore`
 *   inside the trip pipeline, not a separate orchestrator hop)
 * - **updateTimeline** — `applyTickEventWrites` with `tripResult.tickEventWrites`
 *
 * Flow:
 * 1. Fetch vessel locations via fetchVesselLocations()
 * 2. Load vessels, terminals, and active trips in one internal query (soft-fail
 *    this tick if identity tables are empty — no inline sync)
 * 3. Obtain `ConvexVesselLocation` rows from the WSF adapter (fetch + identity map)
 * 4. Capture one tick timestamp for downstream consumers
 * 5. Run domain tick pipeline with injected adapters (locations branch vs trip
 *    branch: **updateVesselTrips** then **updateTimeline**)
 *
 * @param ctx - Convex action context
 * @returns {@link VesselOrchestratorTickResult}; throws if read model, WSF
 *   fetch, or domain tick fails
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

    return runVesselOrchestratorTick(
      {
        convexLocations,
        passengerTerminalAbbrevs,
        tickStartedAt,
        activeTrips,
      },
      createVesselOrchestratorTickDeps(ctx)
    );
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
