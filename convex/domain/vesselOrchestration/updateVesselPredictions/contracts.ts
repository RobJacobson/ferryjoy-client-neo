/**
 * Canonical Stage A public contracts for the predictions concern.
 */

import type { ProductionModelParameters } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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
 * Canonical persisted-row story for Stage A. The current implementation emits
 * proposal rows first and the functions layer owns compare-then-write.
 */
export type VesselTripPredictionRow = VesselTripPredictionProposal;

export type RunUpdateVesselPredictionsInput = {
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
  predictionContext: VesselPredictionContext;
};

/**
 * Pure prediction pipeline output: rows suitable for dedupe/upsert in
 * `functions/vesselOrchestrator` / `batchUpsertProposals`.
 *
 * Timeline ML merge handoffs are returned only from `runVesselPredictionTick`.
 */
export type RunUpdateVesselPredictionsOutput = {
  predictionRows: VesselTripPredictionRow[];
};
