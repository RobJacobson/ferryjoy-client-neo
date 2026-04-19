/**
 * Convex transport wiring for the vessel orchestrator (`runQuery` / `runMutation`).
 *
 * **Boundary:** `convex/functions` only—domain code never imports `ActionCtx`.
 * These objects exist so domain helpers receive plain interfaces (`ScheduledSegmentLookup`,
 * {@link VesselTripTableMutations}, {@link VesselTripPredictionModelAccess}) implemented with Convex.
 *
 * Sequential orchestration steps live in {@link actions.ts}.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { VesselTripTableMutations } from "domain/vesselOrchestration/orchestratorTick/persistVesselTripsCompute";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips";
import { createVesselTripPredictionModelAccess } from "functions/predictions/createVesselTripPredictionModelAccess";

/**
 * Bundles Convex query/mutation bindings used by `updateVesselOrchestrator` steps.
 */
export const createVesselOrchestratorConvexBindings = (
  ctx: ActionCtx
): {
  scheduledEventQueries: ScheduledSegmentLookup;
  vesselTripMutations: VesselTripTableMutations;
  predictionModelQueries: VesselTripPredictionModelAccess;
} => ({
  scheduledEventQueries: createScheduledSegmentLookup(ctx),
  vesselTripMutations: createVesselTripTableMutations(ctx),
  predictionModelQueries: createVesselTripPredictionModelAccess(ctx),
});

/**
 * `eventsScheduled` lookups for `createDefaultProcessVesselTripsDeps` (Convex `runQuery` only).
 */
export const createScheduledSegmentLookup = (
  ctx: ActionCtx
): ScheduledSegmentLookup => ({
  getScheduledDepartureEventBySegmentKey: (segmentKey: string) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDepartureEventBySegmentKey,
      { segmentKey }
    ),
  getScheduledDockEventsForSailingDay: (args: {
    vesselAbbrev: string;
    sailingDay: string;
  }) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDockEventsForSailingDay,
      args
    ),
});

/** Convex `runMutation` bindings for {@link persistVesselTripWriteSet}. */
export const createVesselTripTableMutations = (
  ctx: ActionCtx
): VesselTripTableMutations => ({
  completeAndStartNewTrip: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations.completeAndStartNewTrip,
      args
    ),
  upsertVesselTripsBatch: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      args
    ),
  setDepartNextActualsForMostRecentCompletedTrip: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations
        .setDepartNextActualsForMostRecentCompletedTrip,
      args
    ),
});
