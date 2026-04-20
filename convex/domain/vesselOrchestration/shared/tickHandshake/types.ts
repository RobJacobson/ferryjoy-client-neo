/**
 * Handshake DTOs for the vessel orchestrator tick: trip lifecycle outputs that
 * feed predictions and timeline projection. Owned in `shared/` so
 * `updateVesselTrips` does not depend on `updateTimeline` for primary typing.
 *
 * Branch processors emit facts and per-vessel messages; assembly into
 * `TickEventWrites` happens in `updateTimeline` (`timelineEventAssembler`,
 * `tickEventWrites`).
 */

import type {
  TripEvents,
  TripScheduleCoreResult,
} from "domain/vesselOrchestration/updateVesselTrips";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

/**
 * One successful trip-boundary transition: trips ready for timeline writes.
 *
 * `newTripCore` is schedule/lifecycle output from {@link buildTripCore}; ML is
 * attached in **updateVesselPredictions** before `buildTimelineTickProjectionInput`.
 */
export type CompletedTripBoundaryFact = {
  existingTrip: ConvexVesselTrip;
  tripToComplete: ConvexVesselTrip;
  /**
   * Trip events for the boundary tick (same bundle passed to {@link buildTripCore}).
   * Required for prediction gate derivation and timeline parity.
   */
  events: TripEvents;
  newTripCore: TripScheduleCoreResult;
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
  tripCore: TripScheduleCoreResult;
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
  existingTrip: ConvexVesselTrip | undefined;
  tripCore: TripScheduleCoreResult;
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
 * ML overlay for one vessel’s prediction tick, used to merge `finalProposed` /
 * replacement-trip ML into timeline projection (`buildTimelineTickProjectionInput`).
 *
 * Produced in the same pass as prediction table rows (`runVesselPredictionTick`
 * in `updateVesselPredictions`); not a persistence DTO.
 */
export type PredictedTripComputation = {
  vesselAbbrev: string;
  branch: "completed" | "current";
  completedTrip?: ConvexVesselTrip;
  activeTrip?: ConvexVesselTrip;
  finalPredictedTrip?: ConvexVesselTripWithML;
};

/**
 * Canonical merged shape for one trip tick after lifecycle mutations (before
 * optional ML overlay for `vesselTripPredictions` / timeline projection).
 */
export type TripTickLifecycleOutcome = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
};

/**
 * Persist / handshake label for the result of applying trip-table mutations in one
 * tick. Timeline projection consumes orchestrator `TimelineTripComputation`
 * handoffs; do not use this alias as the primary type for timeline ML merge (see
 * `updateTimeline` / `TimelineProjectionAssembly`).
 */
export type TripLifecycleApplyOutcome = TripTickLifecycleOutcome;

/** Same struct as {@link TripLifecycleApplyOutcome} (functions-layer naming). */
export type VesselTripPersistResult = TripTickLifecycleOutcome;
