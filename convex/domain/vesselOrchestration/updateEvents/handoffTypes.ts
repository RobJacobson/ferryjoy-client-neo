/**
 * Handoff DTOs between trip persistence, prediction-enriched trips, and event
 * projection.
 */

import type { DockTransitionEvents } from "domain/vesselOrchestration/updateVesselTrip";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

/**
 * One completed arrival at dock: rows ready for event and optional
 * prediction-enriched replacement trip for projection.
 *
 * Field names align with VesselTripUpdate: prior active row, completed
 * closeout row, replacement active row; optional same shape with predictions
 * merged for projection.
 */
export type CompletedArrivalHandoff = {
  existingVesselTrip: ConvexVesselTrip;
  completedVesselTrip: ConvexVesselTrip;
  activeVesselTrip: ConvexVesselTrip;
  activeVesselTripWithMl?: ConvexVesselTripWithML;
};

type DockWriteIntentBase = {
  scheduleTrip: ConvexVesselTrip;
  vesselAbbrev: string;
  finalProposed?: ConvexVesselTripWithML;
};

export type ActualDockWriteIntent = DockWriteIntentBase & DockTransitionEvents;

export type PredictedDockWriteIntent = DockWriteIntentBase & {
  existingTrip?: ConvexVesselTrip;
};

export type ActiveTripWriteOutcome = {
  successfulVesselAbbrev?: string;
  pendingActualWrite?: ActualDockWriteIntent;
  pendingPredictedWrite?: PredictedDockWriteIntent;
};

/**
 * Per-branch prediction-enriched trip passed from the vessel-trip prediction pass
 * into event assembly so predicted dock events use the same trip row the
 * models produced (completed closeout vs current active branch).
 */
export type CurrentPredictedTripEventHandoff = {
  vesselAbbrev: string;
  branch: "current";
  finalPredictedTrip: ConvexVesselTripWithML;
};

export type CompletedPredictedTripEventHandoff = {
  vesselAbbrev: string;
  branch: "completed";
  completedHandoffKey: string;
  finalPredictedTrip: ConvexVesselTripWithML;
};

export type PredictedTripEventHandoff =
  | CurrentPredictedTripEventHandoff
  | CompletedPredictedTripEventHandoff;

export type PersistedTripEventHandoff = {
  completedTripFacts: CompletedArrivalHandoff[];
  currentBranch: ActiveTripWriteOutcome;
};
