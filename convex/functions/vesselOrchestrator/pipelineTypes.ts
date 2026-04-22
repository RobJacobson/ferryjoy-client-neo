/**
 * Per-vessel stage outputs for the orchestrator action pipeline.
 *
 * These types give the action a stable vocabulary for the refactor from
 * batch-shaped handoffs toward one-vessel-at-a-time compute stages while
 * keeping Convex reads and writes batched.
 */

import type {
  ActualDockEventRow,
  PredictedDockEventRow,
} from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripPredictionRow } from "domain/vesselOrchestration/updateVesselPredictions";
export type { VesselTripUpdates } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  CompletedTripBoundaryFact,
  PredictedTripComputation,
} from "domain/vesselOrchestration/shared";

/**
 * Canonical single-vessel output for the location stage
 * ({@link computeVesselLocationRows} plus orchestrator-side change detection).
 */
export type VesselLocationUpdates = {
  vesselLocation: ConvexVesselLocation;
  locationChanged: boolean;
};

/**
 * Canonical single-vessel output for the prediction stage
 * ({@link runVesselPredictionPing} in the current batch-shaped baseline).
 */
export type VesselPredictionUpdates = {
  vesselAbbrev: string;
  predictionRows: ReadonlyArray<VesselTripPredictionRow>;
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
};

/**
 * Canonical single-vessel output for the timeline stage
 * ({@link runUpdateVesselTimelineFromAssembly}).
 */
export type VesselTimelineUpdates = {
  vesselAbbrev: string;
  actualEvents: ReadonlyArray<ActualDockEventRow>;
  predictedEvents: ReadonlyArray<PredictedDockEventRow>;
};
