/**
 * Internal action: orchestrate one real-time vessel tick.
 *
 * Loads identity and active trips, fetches one WSF location batch via the adapter,
 * then delegates sequential writes to `orchestratorPipelines.ts`.
 */

import { internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters";
import { createDefaultProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips";
import { createVesselTripPredictionModelAccess } from "functions/predictions/createVesselTripPredictionModelAccess";
import {
  createScheduledSegmentLookup,
  updateVesselPredictions,
  updateVesselTimeline,
  updateVesselTrips,
} from "./orchestratorPipelines";

/**
 * Query read model, fetch WSF locations, run sequential tick writes.
 *
 * @param ctx - Convex action context
 * @throws If identity tables are empty, WSF fetch fails, or a mutation throws
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    try {
      // Load denormalized vessels/terminals/active trips in one query for the tick.
      const snapshot = await ctx.runQuery(
        internal.functions.vesselOrchestrator.queries.getOrchestratorModelData
      );
      if (
        snapshot.vesselsIdentity.length === 0 ||
        snapshot.terminalsIdentity.length === 0
      ) {
        throw new Error(
          "vesselsIdentity or terminalsIdentity empty; skipping tick."
        );
      }

      const { vesselsIdentity, terminalsIdentity, activeTrips } = snapshot;

      // Fetch one WSF batch; feeds both location upsert and trip computation.
      const convexLocations = await fetchWsfVesselLocations(
        vesselsIdentity,
        terminalsIdentity
      );

      // Wire schedule lookups + prediction reads on this ctx for `buildTrip` paths.
      const tripDeps = createDefaultProcessVesselTripsDeps(
        createScheduledSegmentLookup(ctx),
        createVesselTripPredictionModelAccess(ctx)
      );

      const { applyTripResult, tickStartedAt } = await updateVesselTrips(ctx, {
        convexLocations,
        activeTrips,
        tripDeps,
      });

      await updateVesselPredictions(ctx);

      await updateVesselTimeline(ctx, {
        applyTripResult,
        tickStartedAt,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
  },
});
