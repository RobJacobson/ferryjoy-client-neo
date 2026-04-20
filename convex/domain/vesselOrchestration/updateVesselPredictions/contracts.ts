/**
 * Canonical Stage A public contracts for the predictions concern.
 */

import type { ProductionModelParameters } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

/**
 * Plain-data prediction preload blob expected by the Stage A public contract.
 *
 * The functions layer fills this (e.g. production model parameters keyed by
 * terminal pair); domain receives only this POJO, not Convex query ports.
 */
export type VesselPredictionContext = {
  vesselTripPredictions?: ReadonlyArray<{
    VesselAbbrev: string;
    TripKey: string;
    PredictionType: string;
    PredTime: number;
    MinTime: number;
    MaxTime: number;
    MAE: number;
    StdDev: number;
    Actual?: number;
    DeltaTotal?: number;
    DeltaRange?: number;
    UpdatedAt?: number;
  }>;
  productionModelsByPair?: Readonly<
    Record<string, Partial<Record<ModelType, ProductionModelParameters | null>>>
  >;
};

/**
 * Transitional predicted-trip handoff for downstream consumers.
 *
 * The name is legacy, but the shape is now just "which trip branch was
 * predicted this tick, and what was the resulting ML-enriched trip row?"
 */
export type PredictedTripComputation = {
  vesselAbbrev: string;
  branch: "completed" | "current";
  completedTrip?: ConvexVesselTrip;
  activeTrip?: ConvexVesselTrip;
  finalPredictedTrip?: ConvexVesselTripWithML;
};

/**
 * Canonical persisted-row story for Stage A. The current implementation emits
 * proposal rows first and the functions layer owns compare-then-write.
 */
export type VesselTripPredictionRow = VesselTripPredictionProposal;

export type RunUpdateVesselPredictionsInput = {
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
  predictionContext: VesselPredictionContext;
};

export type RunUpdateVesselPredictionsOutput = {
  vesselTripPredictions: VesselTripPredictionRow[];
  predictedTripComputations: PredictedTripComputation[];
};
