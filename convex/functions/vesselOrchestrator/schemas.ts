/**
 * Validators and TypeScript shapes used by the vessel orchestrator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import { vesselTripPredictionProposalSchema } from "functions/vesselTripPredictions/schemas";
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
  VesselTripUpdate,
} from "./pipelineTypes";

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

export type OrchestratorPingPersistence = Infer<
  typeof orchestratorPingPersistenceSchema
>;
