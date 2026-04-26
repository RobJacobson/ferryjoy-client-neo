/**
 * Validators and TypeScript shapes used by the vessel orchestrator.
 */

import { v } from "convex/values";
import { eventsActualSchema } from "functions/events/eventsActual/schemas";
import { predictedDockWriteBatchSchema } from "functions/events/eventsPredicted/schemas";
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
});

const predictedDockWriteIntentSchema = v.object({
  existingTrip: v.optional(vesselTripStoredSchema),
  scheduleTrip: vesselTripStoredSchema,
  vesselAbbrev: v.string(),
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

export const orchestratorPingPersistenceSchema = v.object({
  pingStartedAt: v.number(),
  tripWrites: vesselTripWritesSchema,
  predictionRows: v.array(vesselTripPredictionProposalSchema),
  mlTimelineOverlays: v.array(mlTimelineOverlaySchema),
});

export const persistTripAndPredictionWritesSchema = v.object({
  tripWrites: vesselTripWritesSchema,
  predictionRows: v.array(vesselTripPredictionProposalSchema),
});

export const persistedTripTimelineHandoffSchema = v.object({
  completedFacts: v.array(completedArrivalHandoffSchema),
  currentBranch: v.object({
    successfulVessels: v.array(v.string()),
    pendingActualMessages: v.array(actualDockWriteIntentSchema),
    pendingPredictedMessages: v.array(predictedDockWriteIntentSchema),
  }),
});

export const persistTimelineEventWritesSchema = v.object({
  actualEvents: v.array(eventsActualSchema),
  predictedEvents: v.array(predictedDockWriteBatchSchema),
});
