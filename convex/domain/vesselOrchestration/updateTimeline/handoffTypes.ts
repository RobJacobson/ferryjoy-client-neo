/**
 * Handoff DTOs between trip persistence, prediction overlays, and timeline projection.
 */

import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/updateVesselTrip";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

/**
 * One completed arrival at dock: rows ready for timeline and prediction overlay.
 */
export type CompletedArrivalHandoff = {
  existingTrip: ConvexVesselTrip;
  tripToComplete: ConvexVesselTrip;
  events: TripLifecycleEventFlags;
  scheduleTrip: ConvexVesselTrip;
  newTrip?: ConvexVesselTripWithML;
};

type DockWriteIntentBase = {
  scheduleTrip: ConvexVesselTrip;
  vesselAbbrev: string;
  finalProposed?: ConvexVesselTripWithML;
};

export type ActualDockWriteIntent = DockWriteIntentBase & {
  events: TripLifecycleEventFlags;
};

export type PredictedDockWriteIntent = DockWriteIntentBase & {
  existingTrip?: ConvexVesselTrip;
};

export type ActiveTripWriteOutcome = {
  successfulVesselAbbrev?: string;
  pendingActualWrite?: ActualDockWriteIntent;
  pendingPredictedWrite?: PredictedDockWriteIntent;
};

export type MlTimelineOverlay = {
  vesselAbbrev: string;
  branch: "completed" | "current";
  completedHandoffKey?: string;
  finalPredictedTrip?: ConvexVesselTripWithML;
};

export type PersistedTripTimelineHandoff = {
  completedTripFacts: CompletedArrivalHandoff[];
  currentBranch: ActiveTripWriteOutcome;
};
