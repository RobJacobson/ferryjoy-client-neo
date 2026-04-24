/**
 * Validators and TypeScript shapes used by the vessel orchestrator.
 */

import type { Id } from "_generated/dataModel";
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

export const storedVesselLocationSchema = v.object({
  _id: v.id("vesselLocations"),
  ...vesselLocationValidationSchema.fields,
});

export type VesselLocationUpdates = {
  vesselLocation: ConvexVesselLocation;
  existingLocationId?: Id<"vesselLocations">;
  locationChanged: boolean;
};

export const tripRowsForPingSchema = v.object({
  activeTrips: v.array(vesselTripStoredSchema),
  completedTrips: v.array(vesselTripStoredSchema),
});

export const predictedTripComputationSchema = v.union(
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

export const changedVesselLocationWriteSchema = v.object({
  vesselLocation: vesselLocationValidationSchema,
  existingLocationId: v.optional(v.id("vesselLocations")),
});

export const orchestratorPingPersistenceSchema = v.object({
  pingStartedAt: v.number(),
  changedLocations: v.array(changedVesselLocationWriteSchema),
  existingActiveTrips: v.array(vesselTripStoredSchema),
  tripRows: tripRowsForPingSchema,
  predictionRows: v.array(vesselTripPredictionProposalSchema),
  predictedTripComputations: v.array(predictedTripComputationSchema),
});

export type OrchestratorPingPersistence = Infer<
  typeof orchestratorPingPersistenceSchema
>;
