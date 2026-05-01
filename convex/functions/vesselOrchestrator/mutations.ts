/**
 * Aggregate internal mutations for vessel-orchestrator persistence.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { upsertActualDockRows } from "functions/events/eventsActual/mutations";
import { eventsActualSchema } from "functions/events/eventsActual/schemas";
import { patchDepartNextMlRows } from "functions/events/eventsPredicted/actualizations";
import { upsertPredictedDockBatches } from "functions/events/eventsPredicted/mutations";
import { predictedDockWriteBatchSchema } from "functions/events/eventsPredicted/schemas";
import { upsertPredictionProposals } from "functions/vesselTripPredictions/mutations";
import { vesselTripPredictionProposalSchema } from "functions/vesselTripPredictions/schemas";
import {
  insertCompletedVesselTrip,
  upsertActiveVesselTrip,
} from "functions/vesselTrips/mutations";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";

const updateLeaveDockEventPatchSchema = v.object({
  vesselAbbrev: v.string(),
  depBoundaryKey: v.string(),
  actualDepartMs: v.number(),
});

/**
 * Persists all durable writes for one changed vessel in a single transaction.
 *
 * @param ctx - Convex mutation context
 * @param args - Persistence-ready rows produced by one vessel pipeline branch
 * @returns `null`
 */
export const persistVesselUpdates = internalMutation({
  args: {
    vesselAbbrev: v.string(),
    activeVesselTrip: vesselTripStoredSchema,
    completedVesselTrip: v.optional(vesselTripStoredSchema),
    predictionRows: v.array(vesselTripPredictionProposalSchema),
    actualEvents: v.array(eventsActualSchema),
    predictedEvents: v.array(predictedDockWriteBatchSchema),
    updateLeaveDockEventPatch: v.optional(updateLeaveDockEventPatchSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.completedVesselTrip !== undefined) {
      await insertCompletedVesselTrip(ctx, args.completedVesselTrip);
    }

    await upsertActiveVesselTrip(ctx, args.activeVesselTrip);

    if (args.predictionRows.length > 0) {
      await upsertPredictionProposals(ctx, args.predictionRows);
    }

    if (args.actualEvents.length > 0) {
      await upsertActualDockRows(ctx, args.actualEvents);
    }

    if (args.predictedEvents.length > 0) {
      await upsertPredictedDockBatches(ctx, args.predictedEvents);
    }

    if (args.updateLeaveDockEventPatch !== undefined) {
      await patchDepartNextMlRows(ctx, args.updateLeaveDockEventPatch);
    }

    return null;
  },
});
