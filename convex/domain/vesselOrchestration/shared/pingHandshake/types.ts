/**
 * Handshake DTOs for the vessel orchestrator ping: trip lifecycle outputs that
 * feed predictions and timeline projection. Owned in `shared/` so
 * `updateVesselTrips` does not depend on `updateTimeline` for primary typing.
 *
 * Branch processors emit facts and per-vessel messages; assembly into
 * `PingEventWrites` happens in `updateTimeline` via
 * `buildDockWritesFromTripHandoff` (wired from `orchestratorTimelineProjection.ts`).
 *
 * **Handoff glossary:** see
 * `convex/domain/vesselOrchestration/updateTimeline/README.md` (section **Handoff glossary**).
 */

import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import type { TripLifecycleEventFlags } from "../tripLifecycle";

/**
 * One completed arrival at dock: rows ready for timeline and prediction overlay.
 *
 * `scheduleTrip` is the replacement active row from `buildTripRowsForPing`
 * (schedule fields applied, no ML). **updateVesselPredictions** attaches ML
 * into {@link newTrip} before timeline projection
 * (`buildDockWritesFromTripHandoff`).
 */
export type CompletedArrivalHandoff = {
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
 * Per-vessel payload to build sparse `eventsActual` patches on the current path.
 */
type DockWriteIntentBase = {
  /** Schedule-enriched trip row from the trip stage (pre-ML overlay). */
  scheduleTrip: ConvexVesselTrip;
  vesselAbbrev: string;
  requiresSuccessfulUpsert: boolean;
  /**
   * Set in **updateVesselPredictions** before timeline assembly when ML applies.
   */
  finalProposed?: ConvexVesselTripWithML;
};

export type ActualDockWriteIntent = DockWriteIntentBase & {
  events: TripLifecycleEventFlags;
};

/**
 * Per-vessel payload to build `eventsPredicted` effects on the current path.
 */
export type PredictedDockWriteIntent = DockWriteIntentBase & {
  existingTrip: ConvexVesselTrip | undefined;
};

/**
 * Active-trip path after lifecycle mutations (`successfulVessels` from batch
 * upsert). Used by timeline assembly; must reflect persisted state.
 */
export type ActiveTripWriteOutcome = {
  successfulVessels: Set<string>;
  pendingActualMessages: ActualDockWriteIntent[];
  pendingPredictedMessages: PredictedDockWriteIntent[];
};

/**
 * Same-ping ML overlay for timeline merge (in-memory; not a persistence DTO).
 *
 * Produced alongside prediction table rows (`computeVesselPredictionRows` /
 * `runVesselPredictionPing`); used to merge `finalProposed` / replacement-trip ML
 * into timeline projection (`buildDockWritesFromTripHandoff`).
 */
export type MlTimelineOverlay = {
  vesselAbbrev: string;
  branch: "completed" | "current";
  completedTrip?: ConvexVesselTrip;
  activeTrip?: ConvexVesselTrip;
  finalPredictedTrip?: ConvexVesselTripWithML;
};

/**
 * Canonical trip-persistence handoff for timeline projection.
 */
export type PersistedTripTimelineHandoff = {
  completedFacts: CompletedArrivalHandoff[];
  currentBranch: ActiveTripWriteOutcome;
};

/**
 * Legacy alias for transition; prefer {@link PersistedTripTimelineHandoff}.
 */
export type TripPersistOutcome = PersistedTripTimelineHandoff;
