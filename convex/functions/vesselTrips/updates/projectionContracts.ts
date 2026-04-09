/**
 * DTO-only contracts for Stage 3 timeline projection: facts and intents emitted
 * by lifecycle branch processors, consumed by `timelineProjectionProjector` to
 * build `ProjectionBatch` payloads. Keeps `contracts.ts` focused on tick plans.
 */

import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import type { TripEvents } from "./eventDetection";

/**
 * One successful completed-trip boundary: persisted trips ready for overlay
 * projection (clear old predicted scope, project new trip predictions).
 */
export type CompletedTripProjectionFact = {
  existingTrip: ConvexVesselTrip;
  tripToComplete: ConvexVesselTripWithML;
  newTrip: ConvexVesselTripWithML;
};

/**
 * Raw inputs to build sparse `eventsActual` patches for the current-trip path.
 */
export type CurrentTripActualProjectionIntent = {
  events: TripEvents;
  finalProposed: ConvexVesselTripWithML;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Raw inputs to build `eventsPredicted` effects for the current-trip path.
 */
export type CurrentTripPredictedProjectionIntent = {
  existingTrip: ConvexVesselTrip | undefined;
  finalProposed: ConvexVesselTripWithML;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Lifecycle outcome from `processCurrentTrips` before overlay mutations run.
 */
export type CurrentTripBranchResult = {
  successfulVessels: Set<string>;
  pendingActualIntents: CurrentTripActualProjectionIntent[];
  pendingPredictedIntents: CurrentTripPredictedProjectionIntent[];
};
