/**
 * Validators and TypeScript shapes used by the vessel orchestrator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { vesselTripPredictionProposalSchema } from "functions/vesselTripPredictions/schemas";
import {
  vesselTripStoredSchema,
  vesselTripWithMlSchema,
} from "functions/vesselTrips/schemas";

export type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";

const tripLifecycleEventFlagsSchema = v.object({
  isFirstTrip: v.boolean(),
  isTripStartReady: v.boolean(),
  isCompletedTrip: v.boolean(),
  didJustArriveAtDock: v.boolean(),
  didJustLeaveDock: v.boolean(),
  scheduleKeyChanged: v.boolean(),
});

const completedArrivalHandoffSchema = v.object({
  existingTrip: vesselTripStoredSchema,
  tripToComplete: vesselTripStoredSchema,
  events: tripLifecycleEventFlagsSchema,
  scheduleTrip: vesselTripStoredSchema,
});

const actualDockWriteIntentSchema = v.object({
  events: tripLifecycleEventFlagsSchema,
  scheduleTrip: vesselTripStoredSchema,
  vesselAbbrev: v.string(),
  requiresSuccessfulUpsert: v.boolean(),
});

const predictedDockWriteIntentSchema = v.object({
  existingTrip: v.optional(vesselTripStoredSchema),
  scheduleTrip: vesselTripStoredSchema,
  vesselAbbrev: v.string(),
  requiresSuccessfulUpsert: v.boolean(),
});

export const vesselTripWritesSchema = v.object({
  completedTripWrites: v.array(completedArrivalHandoffSchema),
  activeTripUpserts: v.array(vesselTripStoredSchema),
  actualDockWrites: v.array(actualDockWriteIntentSchema),
  predictedDockWrites: v.array(predictedDockWriteIntentSchema),
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
  tripWrites: vesselTripWritesSchema,
  predictionRows: v.array(vesselTripPredictionProposalSchema),
  mlTimelineOverlays: v.array(mlTimelineOverlaySchema),
});

export type OrchestratorPingPersistence = Infer<
  typeof orchestratorPingPersistenceSchema
>;
