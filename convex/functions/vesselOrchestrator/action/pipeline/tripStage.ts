/**
 * Per-vessel trip-stage compute for orchestrator pings.
 */

import type { ActionCtx } from "_generated/server";
import type {
  MlTimelineOverlay,
  ScheduleContinuityAccess,
} from "domain/vesselOrchestration/shared";
import { updateVesselTrips } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { runPredictionStage } from "./prediction";
import {
  buildTripWritesForVessel,
  type VesselTripWrites,
} from "./tripWrites";

export type TripStageResult = {
  tripWrites: VesselTripWrites;
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Computes sparse trip and prediction writes for one location update.
 *
 * This function is the per-vessel branch coordinator for lifecycle and
 * prediction stages. It exists to keep `action/actions.ts` focused on loop
 * orchestration while this module translates one location change into sparse,
 * persistence-ready outputs. The stage first gates on durable trip diffs from
 * the domain trip updater, then conditionally runs prediction, and finally
 * packages a unified bundle consumed by timeline projection and mutation writes.
 *
 * @param ctx - Convex action context used by prediction stage
 * @param locationUpdate - Normalized vessel location for this loop iteration
 * @param existingActiveTrip - Existing active trip row for the vessel
 * @param scheduleAccess - Continuity lookup adapter for trip-field inference
 * @returns Sparse write bundle, or `null` when no trip rows changed
 */
export const computeTripStageForLocation = async (
  ctx: ActionCtx,
  locationUpdate: ConvexVesselLocation,
  existingActiveTrip: ConvexVesselTrip | undefined,
  scheduleAccess: ScheduleContinuityAccess
): Promise<TripStageResult | null> => {
  // Compute lifecycle deltas first; downstream stages only run when durable facts changed.
  const tripUpdate = await updateVesselTrips({
    vesselLocation: locationUpdate,
    existingActiveTrip,
    scheduleAccess,
  });
  const tripRowsChanged =
    tripUpdate.activeVesselTripUpdate !== undefined ||
    tripUpdate.completedVesselTripUpdate !== undefined;
  // Off-ramp early to avoid prediction/timeline work for no-op trip updates.
  if (!tripRowsChanged) {
    return null;
  }

  // Run prediction from changed trip facts so model reads are demand-driven per vessel.
  const predictionStageResult = await runPredictionStage(ctx, {
    activeTrip:
      tripUpdate.activeVesselTripUpdate === undefined
        ? undefined
        : tripUpdate.activeVesselTripUpdate,
    completedHandoff:
      tripUpdate.completedVesselTripUpdate === undefined ||
      tripUpdate.activeVesselTripUpdate === undefined ||
      existingActiveTrip === undefined
        ? undefined
        : {
            existingTrip: existingActiveTrip,
            tripToComplete: tripUpdate.completedVesselTripUpdate,
            events: {
              isFirstTrip: false,
              isTripStartReady: true,
              isCompletedTrip: true,
              didJustArriveAtDock:
                tripUpdate.completedVesselTripUpdate.ArrivedNextActual !==
                  undefined &&
                existingActiveTrip.ArrivedNextActual !==
                  tripUpdate.completedVesselTripUpdate.ArrivedNextActual,
              didJustLeaveDock: false,
              scheduleKeyChanged:
                existingActiveTrip.ScheduleKey !==
                tripUpdate.completedVesselTripUpdate.ScheduleKey,
            },
            scheduleTrip: tripUpdate.activeVesselTripUpdate,
          },
  });

  return {
    // Build sparse trip writes so persistence only touches rows that materially changed.
    tripWrites: buildTripWritesForVessel({
      existingActiveTrip,
      activeTripUpdate: tripUpdate.activeVesselTripUpdate,
      completedTripUpdate: tripUpdate.completedVesselTripUpdate,
    }),
    predictionRows: predictionStageResult.predictionRows,
    mlTimelineOverlays: predictionStageResult.mlTimelineOverlays,
  };
};
