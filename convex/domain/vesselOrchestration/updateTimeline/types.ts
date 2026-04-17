/**
 * Lifecycle branch outputs consumed by the timeline event assembler.
 *
 * Branch processors emit facts and per-vessel messages only; assembly into
 * `TickEventWrites` payloads are assembled in `timelineEventAssembler.ts` and
 * merged in `tickEventWrites.ts`.
 */

import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type {
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";

/**
 * One successful trip-boundary transition: trips ready for timeline writes.
 */
export type CompletedTripBoundaryFact = {
  existingTrip: ConvexVesselTripWithPredictions;
  tripToComplete: ConvexVesselTripWithML;
  newTrip: ConvexVesselTripWithML;
};

/**
 * Per-vessel message to build sparse `eventsActual` patches on the current path.
 */
export type CurrentTripActualEventMessage = {
  events: TripEvents;
  finalProposed: ConvexVesselTripWithML;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Per-vessel message to build `eventsPredicted` effects on the current path.
 */
export type CurrentTripPredictedEventMessage = {
  existingTrip: ConvexVesselTripWithPredictions | undefined;
  finalProposed: ConvexVesselTripWithML;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Outcome from `processCurrentTrips` before timeline mutations run.
 */
export type CurrentTripLifecycleBranchResult = {
  successfulVessels: Set<string>;
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
};
