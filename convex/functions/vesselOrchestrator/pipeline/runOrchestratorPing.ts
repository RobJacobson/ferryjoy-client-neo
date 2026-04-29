/**
 * Vessel orchestrator pipeline for one ping.
 *
 * The hot path keeps one baseline snapshot query, one WSF fetch, a per-vessel
 * trip loop over the normalized feed for this tick, one locations-only
 * mutation, and one trip/prediction/timeline persistence mutation per changed
 * vessel.
 *
 * The public Convex action entry is `updateVesselOrchestrator` in `../actions.ts`.
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
 * This internal runner preserves the invariant that one WSF batch drives one
 * consistent orchestrator pass. It first builds a baseline snapshot from the
 * query module, then runs location normalization/dedupe, then executes sparse
 * per-vessel domain compute and persistence. Keeping this flow in one
 * function makes control-flow intent explicit while keeping domain details
 * encapsulated in `domain/vesselOrchestration/*` and the persistence
 * mutation boundary.
 *
 * @param ctx - Convex action context used throughout the ping
 * @returns Resolves when this ping has processed all changed vessels
 */
export const runOrchestratorPing = async (ctx: ActionCtx): Promise<void> => {
  // Load one baseline snapshot so all stages run against a consistent read model.
  const snapshot = await loadOrchestratorSnapshot(ctx);

  // Stamp the ping once so downstream timeline rows share the same tick time.
  const pingStartedAt = Date.now();

  /**
   * Stage 1: updateVesselLocations
   *
   * Take the latest fleet snapshot from WSF, normalize it with vessel/terminal
   * identity data, and persist only rows that actually changed.
   *
   * Why: all downstream trip/prediction/timeline work should run only for
   * vessels with new location evidence in this ping.
   */
  const dedupedLocationUpdates = await runUpdateVesselLocations(ctx, {
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });

  // Schedule reads (`createScheduleDbAccess`) are only used in Stage 2
  // (`updateVesselTrip`). Stages 3–5 do not use this adapter.
  const scheduleAccess = createScheduleDbAccess(ctx);

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

      /**
       * Stage 2: updateVesselTrip
       *
       * Core trip-lifecycle step: combine the previous `existingActiveTrip` with
       * this ping's `vesselLocation` to determine whether we completed a trip,
       * updated the active trip, both, or neither.
       *
       * Output is sparse durable trip state: `VesselTripUpdate | null`.
       */
      const tripUpdate = await updateVesselTrip(
        vesselLocation,
        existingActiveTrip,
        scheduleAccess
      );

      // Skip persistence entirely when there are no vessel-trip updates.
      if (tripUpdate === null) {
        continue;
      }

      /**
       * Stage 3: updateVesselPredictions
       *
       * Use `tripUpdate` as the truth of what changed, load only the model
       * context needed for this vessel, then compute prediction proposals and
       * same-ping ML overlays.
       *
       * Why: keep prediction work targeted and ensure timeline projection uses
       * the exact ML output computed for this ping.
       */
      const predictionContext = await loadPredictionContext(ctx, tripUpdate);
      const { predictionRows, mlTimelineOverlays } =
        await updateVesselPredictions({
          tripUpdate,
          predictionContext,
        });

      /**
       * Stage 4: updateTimeline
       *
       * Combine ping time + trip deltas + ML overlays to project timeline event
       * rows (`actualEvents`, `predictedEvents`) for this vessel.
       *
       * Why: timeline writes should be derived from the same trip and prediction
       * evidence that this ping just computed, not from a separate read pass.
       */
      const timelineRows = updateTimeline({
        pingStartedAt,
        tripUpdate,
        mlTimelineOverlays,
      });

      /**
       * Stage 5: persistPerVesselOrchestratorWrites
       *
       * Persist all per-vessel outputs from this ping in one ordered mutation:
       * trip rows, prediction rows, then timeline rows.
       *
       * Why: one mutation keeps side effects for this vessel consistent and
       * makes partial ordering explicitc at the write boundary.
       */
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

      // if (tripUpdate.activeVesselTripUpdate !== undefined) {
      //   console.log("[updateVesselOrchestrator] persisted active vessel trip", {
      //     vesselAbbrev: vesselLocation.VesselAbbrev,
      //     previousActiveTrip: existingActiveTrip ?? null,
      //     nextActiveTrip: tripUpdate.activeVesselTripUpdate,
      //   });
      // }
      // if (tripUpdate.completedVesselTripUpdate !== undefined) {
      //   console.log(
      //     "[updateVesselOrchestrator] persisted completed vessel trip",
      //     {
      //       vesselAbbrev: vesselLocation.VesselAbbrev,
      //       previousActiveTrip: existingActiveTrip ?? null,
      //       completedVesselTrip: tripUpdate.completedVesselTripUpdate,
      //     }
      //   );
      // }
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
