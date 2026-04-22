/**
 * Validators and TypeScript shapes used by the vessel orchestrator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { TerminalIdentity } from "functions/terminals/schemas";
import {
  vesselTripPredictionProposalSchema,
} from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  vesselTripStoredSchema,
  vesselTripWithMlSchema,
} from "functions/vesselTrips/schemas";

export const compactScheduledDepartureEventSchema = v.object({
  Key: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
});

export const inferredScheduledSegmentSchema = v.object({
  Key: v.string(),
  SailingDay: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  DepartingTime: v.number(),
  NextKey: v.optional(v.string()),
  NextDepartingTime: v.optional(v.number()),
});

export const orchestratorScheduleSnapshotSchema = v.object({
  SailingDay: v.string(),
  UpdatedAt: v.number(),
  scheduledDepartureBySegmentKey: v.record(
    v.string(),
    inferredScheduledSegmentSchema
  ),
  scheduledDeparturesByVesselAbbrev: v.record(
    v.string(),
    v.array(compactScheduledDepartureEventSchema)
  ),
});

export type CompactScheduledDepartureEvent = Infer<
  typeof compactScheduledDepartureEventSchema
>;

export type OrchestratorScheduleSnapshot = Infer<
  typeof orchestratorScheduleSnapshotSchema
>;

export type {
  VesselLocationUpdates,
  VesselPredictionUpdates,
  VesselTimelineUpdates,
  VesselTripUpdates,
} from "./pipelineTypes";

/**
 * One WSF batch plus identity rows after adapter conversion, before sequential
 * writes in `updateVesselOrchestrator`.
 */
export type VesselOrchestratorTickSnapshot = {
  convexLocations: ReadonlyArray<ConvexVesselLocation>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
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

export const orchestratorPingPersistenceSchema = v.object({
  pingStartedAt: v.number(),
  changedLocations: v.array(vesselLocationValidationSchema),
  existingActiveTrips: v.array(vesselTripStoredSchema),
  tripRows: tripRowsForPingSchema,
  predictionRows: v.array(vesselTripPredictionProposalSchema),
  predictedTripComputations: v.array(predictedTripComputationSchema),
});

export const tripEventsSchema = v.object({
  isFirstTrip: v.boolean(),
  isTripStartReady: v.boolean(),
  isCompletedTrip: v.boolean(),
  didJustArriveAtDock: v.boolean(),
  didJustLeaveDock: v.boolean(),
  scheduleKeyChanged: v.boolean(),
});

export const completedTripBoundaryFactSchema = v.object({
  existingTrip: vesselTripStoredSchema,
  tripToComplete: vesselTripStoredSchema,
  events: tripEventsSchema,
  scheduleTrip: vesselTripStoredSchema,
  newTrip: v.optional(vesselTripWithMlSchema),
});

export const currentTripActualEventMessageSchema = v.object({
  events: tripEventsSchema,
  scheduleTrip: vesselTripStoredSchema,
  vesselAbbrev: v.string(),
  requiresSuccessfulUpsert: v.boolean(),
  finalProposed: v.optional(vesselTripWithMlSchema),
});

export const currentTripPredictedEventMessageSchema = v.object({
  existingTrip: v.optional(vesselTripStoredSchema),
  scheduleTrip: vesselTripStoredSchema,
  vesselAbbrev: v.string(),
  requiresSuccessfulUpsert: v.boolean(),
  finalProposed: v.optional(vesselTripWithMlSchema),
});

export const currentTripLifecycleBranchResultSchema = v.object({
  successfulVessels: v.array(v.string()),
  pendingActualMessages: v.array(currentTripActualEventMessageSchema),
  pendingPredictedMessages: v.array(currentTripPredictedEventMessageSchema),
});

export const timelineProjectionAssemblySchema = v.object({
  completedFacts: v.array(completedTripBoundaryFactSchema),
  currentBranch: currentTripLifecycleBranchResultSchema,
});
