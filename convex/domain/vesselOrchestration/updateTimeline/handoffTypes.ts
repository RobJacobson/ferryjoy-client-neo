/**
 * Handoff DTOs between trip persistence, prediction-enriched trips, and timeline
 * projection.
 */

import type { CurrentTripDockEvents } from "domain/vesselOrchestration/updateVesselTrip";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

/**
 * One completed arrival at dock: rows ready for timeline and optional
 * prediction-enriched replacement trip for projection.
 *
 * Field names align with `VesselTripUpdate`: prior active row, completed
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

export type ActualDockWriteIntent = DockWriteIntentBase & CurrentTripDockEvents;

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
 * into timeline assembly so predicted dock events use the same trip row the
 * models produced (completed closeout vs current active branch).
 */
export type PredictedTripTimelineHandoff = {
  vesselAbbrev: string;
  branch: "completed" | "current";
  completedHandoffKey?: string;
  finalPredictedTrip?: ConvexVesselTripWithML;
};

export type PersistedTripTimelineHandoff = {
  completedTripFacts: CompletedArrivalHandoff[];
  currentBranch: ActiveTripWriteOutcome;
};
