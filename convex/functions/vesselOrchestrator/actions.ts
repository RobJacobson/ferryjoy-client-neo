/**
 * Vessel orchestrator actions.
 *
 * The hot path keeps one baseline snapshot query, one WSF fetch, a per-vessel
 * trip loop over the normalized feed for this tick, one locations-only
 * mutation, and one trip/prediction/timeline persistence mutation per ping.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { v } from "convex/values";
import type {
  MlTimelineOverlay,
  ScheduleContinuityAccess,
} from "domain/vesselOrchestration/shared";
import { updateVesselTrips } from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  ENABLE_ORCHESTRATOR_SANITY_METRICS,
  ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS,
  ORCHESTRATOR_SANITY_SCHEDULE_LOG_EVENT,
} from "./constants";
import { loadVesselLocationUpdates } from "./locationUpdates";
import { runPredictionStage } from "./predictionStage";
import {
  createScheduleContinuityAccess,
  type ScheduleContinuityMetricsSummary,
} from "./scheduleContinuityAccess";

type OrchestratorSnapshot = {
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
};

type TripStageResult = {
  existingActiveTrip?: ConvexVesselTrip;
  activeTripUpdate?: ConvexVesselTrip;
  completedTripUpdate?: ConvexVesselTrip;
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Internal action: load identity and active trips, fetch live locations, and
 * persist one orchestrator ping.
 *
 * @returns Nothing; logs and rethrows on failure
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

/**
 * Runs one full orchestrator ping from location ingest through timeline writes.
 *
 * @param ctx - Convex action context for all ping-side reads and writes
 */
const runOrchestratorPing = async (ctx: ActionCtx): Promise<void> => {
  const snapshot = await loadOrchestratorSnapshot(ctx);
  const pingStartedAt = Date.now();
  const locationUpdates = await loadVesselLocationUpdates({
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });
  const dedupedLocationUpdates = await ctx.runMutation(
    api.functions.vesselLocation.mutations.bulkUpsertVesselLocations,
    {
      locations: Array.from(locationUpdates),
    }
  );
  const scheduleAccess = createScheduleContinuityAccess(ctx);
  const activeTripsByVesselAbbrev = new Map(
    snapshot.activeTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  for (const vesselLocation of dedupedLocationUpdates) {
    try {
      const existingActiveTrip = activeTripsByVesselAbbrev.get(
        vesselLocation.VesselAbbrev
      );
      const tripStageResult = await computeTripStageForLocation(
        ctx,
        vesselLocation,
        existingActiveTrip,
        scheduleAccess
      );
      if (tripStageResult === null) {
        continue;
      }

      await ctx.runMutation(
        internal.functions.vesselOrchestrator.mutations
          .persistPerVesselOrchestratorWrites,
        {
          pingStartedAt,
          tripWrite: {
            existingActiveTrip: tripStageResult.existingActiveTrip,
            activeTripUpdate: tripStageResult.activeTripUpdate,
            completedTripUpdate: tripStageResult.completedTripUpdate,
          },
          predictionRows: Array.from(tripStageResult.predictionRows),
          mlTimelineOverlays: Array.from(tripStageResult.mlTimelineOverlays),
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

  logScheduleContinuitySanitySummary(
    pingStartedAt,
    scheduleAccess.getMetricsSummary()
  );
};

/**
 * Loads the baseline read model required for one orchestrator ping.
 *
 * @param ctx - Convex action context for internal snapshot query
 * @returns Identity tables and active trips
 */
const loadOrchestratorSnapshot = async (
  ctx: ActionCtx
): Promise<OrchestratorSnapshot> => {
  const snapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.getOrchestratorModelData
  );
  if (
    snapshot.vesselsIdentity.length === 0 ||
    snapshot.terminalsIdentity.length === 0
  ) {
    throw new Error(
      "vesselsIdentity or terminalsIdentity empty; skipping ping."
    );
  }
  return snapshot;
};

/**
 * Computes sparse per-vessel trip and prediction writes for one location update.
 *
 * @param ctx - Convex action context for prediction model preload
 * @param locationUpdate - One normalized live location row
 * @param existingActiveTrip - Existing active trip for this vessel
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Sparse per-vessel write bundle, or null when trip rows are unchanged
 */
export const computeTripStageForLocation = async (
  ctx: ActionCtx,
  locationUpdate: ConvexVesselLocation,
  existingActiveTrip: ConvexVesselTrip | undefined,
  scheduleAccess: ScheduleContinuityAccess
): Promise<TripStageResult | null> => {
  const tripUpdate = await updateVesselTrips({
    vesselLocation: locationUpdate,
    existingActiveTrip,
    scheduleAccess,
  });
  const tripRowsChanged =
    tripUpdate.activeVesselTripUpdate !== undefined ||
    tripUpdate.completedVesselTripUpdate !== undefined;
  if (!tripRowsChanged) {
    return null;
  }

  const predictionStageResult = await runPredictionStage(ctx, {
    activeTrips:
      tripUpdate.activeVesselTripUpdate === undefined
        ? []
        : [tripUpdate.activeVesselTripUpdate],
    completedHandoffs:
      tripUpdate.completedVesselTripUpdate === undefined ||
      tripUpdate.activeVesselTripUpdate === undefined ||
      existingActiveTrip === undefined
        ? []
        : [
            {
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
          ],
  });

  return {
    existingActiveTrip,
    activeTripUpdate: tripUpdate.activeVesselTripUpdate,
    completedTripUpdate: tripUpdate.completedVesselTripUpdate,
    predictionRows: predictionStageResult.predictionRows,
    mlTimelineOverlays: predictionStageResult.mlTimelineOverlays,
  };
};

const logScheduleContinuitySanitySummary = (
  pingStartedAt: number,
  summary: ScheduleContinuityMetricsSummary | null
): void => {
  if (
    !ENABLE_ORCHESTRATOR_SANITY_METRICS ||
    !ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS ||
    summary === null
  ) {
    return;
  }

  console.info(ORCHESTRATOR_SANITY_SCHEDULE_LOG_EVENT, {
    pingStartedAt,
    ...summary,
  });
};
