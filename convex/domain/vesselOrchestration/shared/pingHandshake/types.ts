/**
 * Handshake DTOs for the vessel orchestrator ping: trip lifecycle outputs that
 * feed predictions and timeline projection. Owned in `shared/` so
 * `updateVesselTrips` does not depend on `updateTimeline` for primary typing.
 *
 * Branch processors emit facts and per-vessel messages; assembly into
 * `PingEventWrites` happens in `updateTimeline` (`timelineEventAssembler.ts`).
 */

import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import type { TripLifecycleEventFlags } from "../tripLifecycle";

/**
 * One successful trip-boundary transition: trips ready for timeline writes.
 *
 * `scheduleTrip` is the replacement active row from `buildTripRowsForPing`
 * (schedule fields applied, no ML). **updateVesselPredictions** attaches ML
 * into {@link newTrip} before timeline projection
 * (`buildTimelinePingProjectionInput`).
 */
export type CompletedTripBoundaryFact = {
  existingTrip: ConvexVesselTrip;
  tripToComplete: ConvexVesselTrip;
  /**
   * Trip events for the boundary ping from the trip stage.
   * Required for prediction gate derivation and timeline parity.
   */
  events: TripLifecycleEventFlags;
  /** Replacement active row after schedule enrichment (pre-ML). */
  scheduleTrip: ConvexVesselTrip;
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
type CurrentTripEventMessageBase = {
  /** Schedule-enriched trip row from the trip stage (pre-ML overlay). */
  scheduleTrip: ConvexVesselTrip;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
  /**
   * Set in **updateVesselPredictions** before timeline assembly when ML applies.
   */
  finalProposed?: ConvexVesselTripWithML;
};

export type CurrentTripActualEventMessage = CurrentTripEventMessageBase & {
  events: TripLifecycleEventFlags;
};

/**
 * Per-vessel message to build `eventsPredicted` effects on the current path.
 */
export type CurrentTripPredictedEventMessage = CurrentTripEventMessageBase & {
  existingTrip: ConvexVesselTrip | undefined;
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
 * ML overlay for one vessel’s prediction ping, used to merge `finalProposed` /
 * replacement-trip ML into timeline projection (`buildTimelinePingProjectionInput`).
 *
 * Produced in the same pass as prediction table rows (`computeVesselPredictionRows`
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
 * Canonical merged shape for one trip ping after lifecycle mutations (before
 * optional ML overlay for `vesselTripPredictions` / timeline projection).
 */
export type TripPingLifecycleOutcome = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
};

/** Persist/handshake label for one ping's trip-table mutation result. */
export type VesselTripPersistResult = TripPingLifecycleOutcome;
