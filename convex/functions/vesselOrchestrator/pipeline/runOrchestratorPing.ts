/**
 * Orchestrator pipeline runner for one ping.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { updateTimeline } from "domain/vesselOrchestration/updateTimeline";
import { updateVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions";
import { updateVesselTrip } from "domain/vesselOrchestration/updateVesselTrip";
import { loadOrchestratorSnapshot } from "./loadSnapshot";
import { runUpdateVesselLocations } from "./updateVesselLocations";
import { loadPredictionContext } from "./updateVesselPredictions";
import { createScheduleDbAccess } from "./updateVesselTrip";

/**
 * Executes one ping pipeline after the action shell handles top-level errors.
 *
 * @param ctx - Convex action context used throughout the ping
 * @returns Resolves when this ping has processed all changed vessels
 */
export const runOrchestratorPing = async (ctx: ActionCtx): Promise<void> => {
  const snapshot = await loadOrchestratorSnapshot(ctx);
  const pingStartedAt = Date.now();
  const dedupedLocationUpdates = await runUpdateVesselLocations(ctx, {
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });
  const scheduleAccess = createScheduleDbAccess(ctx);
  const activeTripsByVesselAbbrev = new Map(
    snapshot.activeTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  for (const vesselLocation of dedupedLocationUpdates) {
    try {
      const existingActiveTrip = activeTripsByVesselAbbrev.get(
        vesselLocation.VesselAbbrev
      );
      const tripUpdate = await updateVesselTrip(
        vesselLocation,
        existingActiveTrip,
        scheduleAccess
      );
      if (tripUpdate === null) {
        continue;
      }

      const predictionContext = await loadPredictionContext(ctx, tripUpdate);
      const { predictionRows, mlTimelineOverlays } =
        await updateVesselPredictions({
          tripUpdate,
          predictionContext,
        });
      const timelineRows = updateTimeline({
        pingStartedAt,
        tripUpdate,
        mlTimelineOverlays,
      });
      const { activeVesselTripUpdate, completedVesselTripUpdate } = tripUpdate;

      if (activeVesselTripUpdate !== undefined) {
        console.log("[updateVesselOrchestrator] updated active vessel trip", {
          vesselAbbrev: vesselLocation.VesselAbbrev,
          previousActiveTrip: existingActiveTrip ?? null,
          nextActiveTrip: activeVesselTripUpdate,
        });
      }
      if (completedVesselTripUpdate !== undefined) {
        console.log(
          "[updateVesselOrchestrator] updated completed vessel trip",
          {
            vesselAbbrev: vesselLocation.VesselAbbrev,
            previousActiveTrip: existingActiveTrip ?? null,
            completedVesselTrip: completedVesselTripUpdate,
          }
        );
      }

      await ctx.runMutation(
        internal.functions.vesselOrchestrator.mutations
          .persistPerVesselOrchestratorWrites,
        {
          vesselAbbrev: tripUpdate.vesselAbbrev,
          existingActiveTrip: tripUpdate.existingActiveTrip,
          activeVesselTrip: tripUpdate.activeVesselTripUpdate,
          completedVesselTrip: tripUpdate.completedVesselTripUpdate,
          predictionRows: Array.from(predictionRows),
          actualEvents: timelineRows.actualEvents,
          predictedEvents: timelineRows.predictedEvents,
        }
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator] per-vessel pipeline failed", {
        vesselAbbrev: vesselLocation.VesselAbbrev,
        message: err.message,
        stack: err.stack,
      });
    }
  }
};

