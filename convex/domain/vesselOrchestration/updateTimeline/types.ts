/**
 * Lifecycle branch outputs consumed by the timeline event assembler.
 *
 * Branch processors emit facts and per-vessel messages only; assembly into
 * `TickEventWrites` payloads are assembled in `timelineEventAssembler.ts` and
 * merged in `tickEventWrites.ts`.
 */

import type { BuildTripCoreResult } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type {
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";

/**
 * One successful trip-boundary transition: trips ready for timeline writes.
 *
 * `newTripCore` is schedule + gates from {@link buildTripCore}; ML is attached
 * in **updateVesselPredictions** before `buildTimelineTickProjectionInput`.
 */
export type CompletedTripBoundaryFact = {
  existingTrip: ConvexVesselTripWithPredictions;
  tripToComplete: ConvexVesselTripWithML;
  newTripCore: BuildTripCoreResult;
  /**
   * ML-enriched replacement row for `buildPredictedDockWriteBatch`. Optional on
   * the wire until `updateVesselPredictions` merge; **required** before timeline
   * projection (assembler throws if missing).
   */
  newTrip?: ConvexVesselTripWithML;
};

/**
 * Per-vessel message to build sparse `eventsActual` patches on the current path.
 */
export type CurrentTripActualEventMessage = {
  events: TripEvents;
  tripCore: BuildTripCoreResult;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
  /**
   * Set in **updateVesselPredictions** before timeline assembly when ML applies.
   */
  finalProposed?: ConvexVesselTripWithML;
};

/**
 * Per-vessel message to build `eventsPredicted` effects on the current path.
 */
export type CurrentTripPredictedEventMessage = {
  existingTrip: ConvexVesselTripWithPredictions | undefined;
  tripCore: BuildTripCoreResult;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
  /**
   * Set in **updateVesselPredictions** before timeline assembly when ML applies.
   */
  finalProposed?: ConvexVesselTripWithML;
};

/**
 * Current-trip branch after lifecycle mutations (`successfulVessels` from batch
 * upsert). Used by timeline assembly; must reflect persisted state.
 */
export type CurrentTripLifecycleBranchResult = {
  successfulVessels: Set<string>;
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
};

/**
 * Result of applying a vessel-trip tick (lifecycle mutations), before optional ML
 * overlay for `vesselTripPredictions` / timeline projection.
 */
export type TripLifecycleApplyOutcome = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
};
