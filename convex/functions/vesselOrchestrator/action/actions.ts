/**
 * Vessel orchestrator actions.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { v } from "convex/values";
import { updateTimeline } from "domain/vesselOrchestration/updateTimeline";
import { createScheduleContinuityAccess } from "./pipeline/scheduleContinuity";
import { loadOrchestratorSnapshot } from "./pipeline/snapshot";
import { toTimelineHandoffFromTripWrites } from "./pipeline/timelineHandoff";
import { computeTripStageForLocation } from "./pipeline/tripStage";
import { updateVesselLocations } from "./pipeline/updateVesselLocations";

/**
 * Runs one orchestrator tick from location ingest through per-vessel writes.
 *
 * This is the orchestrator module's public action boundary and the only place
 * that coordinates cross-module sequencing for a live ping. It exists to keep
 * domain logic pure while centralizing side-effect ordering across
 * `action/pipeline/*`, `functions/vesselLocation/mutations`, and
 * `mutation/mutations`. The handler delegates most compute to pipeline helpers,
 * but intentionally owns failure semantics and stage order so trip, prediction,
 * and timeline writes stay causally aligned for the same vessel update.
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

/**
 * Executes one ping pipeline after the action shell handles top-level errors.
 *
 * This internal runner preserves the invariant that one WSF batch drives one
 * consistent orchestrator pass. It first builds a baseline snapshot from the
 * query module, then runs location normalization/dedupe, then executes sparse
 * per-vessel stage compute and persistence. Keeping this flow in one function
 * makes control-flow intent explicit while keeping stage details encapsulated
 * in pipeline helpers and mutation/query module boundaries.
 *
 * @param ctx - Convex action context used throughout the ping
 * @returns Resolves when this ping has processed all changed vessels
 */
const runOrchestratorPing = async (ctx: ActionCtx): Promise<void> => {
  // Load one baseline snapshot so all stages run against a consistent read model.
  const snapshot = await loadOrchestratorSnapshot(ctx);

  // Stamp the ping once so downstream timeline rows share the same tick time.
  const pingStartedAt = Date.now();

  // Update location rows: fetch, normalize, augment, persist, and dedupe.
  const dedupedLocationUpdates = await updateVesselLocations(ctx, {
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });

  // Reuse one memoized schedule adapter for all per-vessel trip continuity reads.
  const scheduleAccess = createScheduleContinuityAccess(ctx);

  // Index active trips once to avoid repeated linear scans inside the hot loop.
  const activeTripsByVesselAbbrev = new Map(
    snapshot.activeTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  // Keep per-vessel isolation so one bad branch does not abort the whole ping.
  for (const vesselLocation of dedupedLocationUpdates) {
    try {
      const existingActiveTrip = activeTripsByVesselAbbrev.get(
        vesselLocation.VesselAbbrev
      );

      // Compute sparse trip/prediction writes from this location change only.
      const tripStageResult = await computeTripStageForLocation(
        ctx,
        vesselLocation,
        existingActiveTrip,
        scheduleAccess
      );

      // Skip persistence entirely when the trip stage produced no durable changes.
      if (tripStageResult === null) {
        continue;
      }

      // Project timeline rows in-memory from same-ping trip facts and ML overlays.
      const timelineRows = updateTimeline({
        pingStartedAt,
        tripHandoffForTimeline: toTimelineHandoffFromTripWrites(
          tripStageResult.tripWrites
        ),
        mlTimelineOverlays: tripStageResult.mlTimelineOverlays,
      });

      // Apply trip, prediction, and timeline rows together through one mutation.
      await ctx.runMutation(
        internal.functions.vesselOrchestrator.mutation.mutations
          .persistPerVesselOrchestratorWrites,
        {
          tripWrites: tripStageResult.tripWrites,
          predictionRows: Array.from(tripStageResult.predictionRows),
          actualEvents: timelineRows.actualEvents,
          predictedEvents: timelineRows.predictedEvents,
        }
      );
    } catch (error) {
      // Log and continue so one vessel failure does not block other vessel branches.
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator] per-vessel pipeline failed", {
        vesselAbbrev: vesselLocation.VesselAbbrev,
        message: err.message,
        stack: err.stack,
      });
    }
  }
};
