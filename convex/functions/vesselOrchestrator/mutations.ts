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
import { bulkUpsertLocationsAndUpdatesInDb } from "functions/vesselLocationsUpdates/mutations";
import { batchUpsertProposalsInDb } from "functions/vesselTripPredictions/mutations";
import {
  completeAndStartNewTripInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
  upsertVesselTripsBatchInDb,
} from "functions/vesselTrips/mutations";
import { persistVesselTripWriteSet } from "./persistVesselTripWriteSet";
import { orchestratorPingPersistenceSchema } from "./schemas";

export const persistOrchestratorPing = internalMutation({
  args: orchestratorPingPersistenceSchema,
  returns: v.null(),
  handler: async (ctx, args) => {
    await bulkUpsertLocationsAndUpdatesInDb(ctx, args.changedLocations);

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
        projectionAssembly: {
          completedFacts: tripPersistResult.completedFacts,
          currentBranch: tripPersistResult.currentBranch,
        },
        predictedTripComputations: args.predictedTripComputations,
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
