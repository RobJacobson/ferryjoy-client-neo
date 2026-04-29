/**
 * Validators for vessel-orchestrator mutation write contracts.
 */

import { v } from "convex/values";
import { eventsActualSchema } from "functions/events/eventsActual/schemas";
import { predictedDockWriteBatchSchema } from "functions/events/eventsPredicted/schemas";
import { vesselTripPredictionProposalSchema } from "functions/vesselTripPredictions/schemas";
import {
  vesselTripStoredSchema,
  vesselTripWithMlSchema,
} from "functions/vesselTrips/schemas";

export const persistPerVesselOrchestratorWritesSchema = v.object({
  vesselAbbrev: v.string(),
  existingActiveTrip: v.optional(vesselTripStoredSchema),
  activeVesselTrip: vesselTripStoredSchema,
  completedVesselTrip: v.optional(vesselTripStoredSchema),
  predictionRows: v.array(vesselTripPredictionProposalSchema),
  actualEvents: v.array(eventsActualSchema),
  predictedEvents: v.array(predictedDockWriteBatchSchema),
});

// Maintains backward compatibility for existing ML overlay tests/imports.
export const mlTimelineOverlaySchema = v.union(
  v.object({
    vesselAbbrev: v.string(),
    branch: v.literal("completed"),
    completedHandoffKey: v.optional(v.string()),
    finalPredictedTrip: v.optional(vesselTripWithMlSchema),
  }),
  v.object({
    vesselAbbrev: v.string(),
    branch: v.literal("current"),
    completedHandoffKey: v.optional(v.string()),
    finalPredictedTrip: v.optional(vesselTripWithMlSchema),
  })
);
