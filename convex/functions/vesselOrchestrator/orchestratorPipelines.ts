/**
 * Vessel orchestrator (functions layer): adapter wiring (`ctx.runQuery`) and test helpers.
 * Sequential tick steps live in {@link actions.ts}.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import {
  materializeVesselTripPredictionUpsertAndMergedBranch,
} from "domain/vesselOrchestration/orchestratorTick/materializePostTripTableWrites";
import type { TripLifecycleApplyOutcome } from "domain/vesselOrchestration/updateTimeline";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips";

/**
 * `eventsScheduled` lookups for `createDefaultProcessVesselTripsDeps` (Convex query wiring only).
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

/** Test helper: predictions table write + merged branch for timeline assembly elsewhere. */
export const applyPredictionsToTripApplyResult = async (
  ctx: ActionCtx,
  applyTripResult: TripLifecycleApplyOutcome,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<TripLifecycleApplyOutcome> => {
  const { vesselTripPredictionsMutationArgs, mergedApplyResult } =
    await materializeVesselTripPredictionUpsertAndMergedBranch(
      applyTripResult,
      predictionModelAccess
    );
  if (vesselTripPredictionsMutationArgs.proposals.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselTripPredictions.mutations.batchUpsertProposals,
      vesselTripPredictionsMutationArgs
    );
  }
  return mergedApplyResult;
};
