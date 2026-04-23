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
export type CurrentTripActualEventMessage = {
  events: TripLifecycleEventFlags;
  /** Schedule-enriched trip row from the trip stage (pre-ML overlay). */
  scheduleTrip: ConvexVesselTrip;
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
  scheduleTrip: ConvexVesselTrip;
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

/** Leave-dock effect bundled with the ping compute for depart-next actualization. */
export type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTrip;
};

/** Current-branch payload grouped for persistence and timeline assembly. */
export type ActiveTripsBranch = {
  activeUpserts: ConvexVesselTrip[];
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
  pendingLeaveDockEffects: PendingLeaveDockEffect[];
};

/**
 * Trip + lifecycle messages for one ping, before trip-table mutations.
 * Feeds storage row builders and timeline projection inputs.
 */
export type VesselTripsComputeBundle = {
  completedHandoffs: CompletedTripBoundaryFact[];
  current: ActiveTripsBranch;
};

/**
 * One vessel’s row for timeline projection (Stage C), derived from the compute bundle.
 */
export type TripComputation =
  | {
      branch: "completed";
      vesselAbbrev: string;
      events: TripLifecycleEventFlags;
      existingTrip: ConvexVesselTrip;
      completedTrip: ConvexVesselTrip;
      /** Replacement active row used for persist gates (same as `scheduleTrip` today). */
      activeTrip: ConvexVesselTrip;
      /** Schedule-enriched row from the trip stage (pre-ML). */
      scheduleTrip: ConvexVesselTrip;
    }
  | {
      branch: "current";
      vesselAbbrev: string;
      events?: TripLifecycleEventFlags;
      existingTrip?: ConvexVesselTrip;
      activeTrip: ConvexVesselTrip;
      scheduleTrip: ConvexVesselTrip;
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
