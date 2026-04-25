/**
 * Validators and TypeScript shapes used by the vessel orchestrator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import { vesselTripPredictionProposalSchema } from "functions/vesselTripPredictions/schemas";
import {
  vesselTripStoredSchema,
  vesselTripWithMlSchema,
} from "functions/vesselTrips/schemas";

export type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";

export type VesselLocationUpdates = {
  vesselLocation: ConvexVesselLocation;
};

export const tripRowsForPingSchema = v.object({
  activeTrips: v.array(vesselTripStoredSchema),
  completedTrips: v.array(vesselTripStoredSchema),
});

export const mlTimelineOverlaySchema = v.union(
  v.object({
    vesselAbbrev: v.string(),
    branch: v.literal("completed"),
    completedTrip: v.optional(vesselTripStoredSchema),
    activeTrip: v.optional(vesselTripStoredSchema),
    finalPredictedTrip: v.optional(vesselTripWithMlSchema),
  }),
  v.object({
    vesselAbbrev: v.string(),
    branch: v.literal("current"),
    completedTrip: v.optional(vesselTripStoredSchema),
    activeTrip: v.optional(vesselTripStoredSchema),
    finalPredictedTrip: v.optional(vesselTripWithMlSchema),
  })
);

export const orchestratorPingPersistenceSchema = v.object({
  pingStartedAt: v.number(),
  feedLocations: v.array(vesselLocationValidationSchema),
  existingActiveTrips: v.array(vesselTripStoredSchema),
  tripRows: tripRowsForPingSchema,
  predictionRows: v.array(vesselTripPredictionProposalSchema),
  mlTimelineOverlays: v.array(mlTimelineOverlaySchema),
});

export type OrchestratorPingPersistence = Infer<
  typeof orchestratorPingPersistenceSchema
>;
