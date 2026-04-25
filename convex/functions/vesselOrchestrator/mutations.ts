/**
 * Internal mutation for the orchestrator-owned hot write path.
 *
 * This collapses per-ping writes into one functions-owned entrypoint so the
 * action computes plain-data outputs and hands off one persistence bundle.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { runUpdateVesselTimelineFromAssembly } from "domain/vesselOrchestration/updateTimeline";
import { upsertActualDockRows } from "functions/events/eventsActual/mutations";
import { projectPredictedDockWriteBatchesInDb } from "functions/events/eventsPredicted/mutations";
import { performBulkUpsertVesselLocations } from "functions/vesselLocation/mutations";
import { batchUpsertProposalsInDb } from "functions/vesselTripPredictions/mutations";
import {
  completeAndStartNewTripInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
  upsertVesselTripsBatchInDb,
} from "functions/vesselTrips/mutations";
import {
  ENABLE_ORCHESTRATOR_SANITY_METRICS,
  ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS,
  ORCHESTRATOR_SANITY_LOCATION_LOG_EVENT,
} from "./constants";
import { persistVesselTripWriteSet } from "./persistVesselTripWriteSet";
import { orchestratorPingPersistenceSchema } from "./schemas";

export const persistOrchestratorPing = internalMutation({
  args: orchestratorPingPersistenceSchema,
  returns: v.null(),
  handler: async (ctx, args) => {
    const locationDedupeSummary = await performBulkUpsertVesselLocations(
      ctx,
      args.feedLocations
    );
    if (
      ENABLE_ORCHESTRATOR_SANITY_METRICS &&
      ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS &&
      locationDedupeSummary !== null
    ) {
      console.info(ORCHESTRATOR_SANITY_LOCATION_LOG_EVENT, {
        pingStartedAt: args.pingStartedAt,
        ...locationDedupeSummary,
      });
    }

    const tripPersistResult = await persistVesselTripWriteSet(
      args.tripRows,
      args.existingActiveTrips,
      {
        completeAndStartNewTrip: async ({ completedTrip, newTrip }) =>
          completeAndStartNewTripInDb(ctx, completedTrip, newTrip),
        upsertVesselTripsBatch: async ({ activeUpserts }) =>
          upsertVesselTripsBatchInDb(ctx, activeUpserts),
        setDepartNextActualsForMostRecentCompletedTrip: async ({
          vesselAbbrev,
          actualDepartMs,
        }) =>
          setDepartNextActualsForMostRecentCompletedTripInDb(
            ctx,
            vesselAbbrev,
            actualDepartMs
          ),
      }
    );

    if (args.predictionRows.length > 0) {
      await batchUpsertProposalsInDb(ctx, args.predictionRows);
    }

    const { actualEvents, predictedEvents } =
      runUpdateVesselTimelineFromAssembly({
        pingStartedAt: args.pingStartedAt,
        tripHandoffForTimeline: {
          completedFacts: tripPersistResult.completedFacts,
          currentBranch: tripPersistResult.currentBranch,
        },
        mlTimelineOverlays: args.mlTimelineOverlays,
      });

    if (actualEvents.length > 0) {
      await upsertActualDockRows(ctx, actualEvents);
    }

    if (predictedEvents.length > 0) {
      await projectPredictedDockWriteBatchesInDb(ctx, predictedEvents);
    }

    return null;
  },
});
