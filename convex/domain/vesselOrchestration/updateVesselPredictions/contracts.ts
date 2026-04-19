/**
 * Canonical Stage A public contracts for the predictions concern.
 */

import type { ProductionModelParameters } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import type { TripComputation } from "domain/vesselOrchestration/updateVesselTrips";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type {
  ConvexPrediction,
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
 * Minimal prediction payload carried between predictions and timeline in Stage A.
 */
export type TripPredictionSet = Partial<
  Record<
    | "AtDockDepartCurr"
    | "AtDockArriveNext"
    | "AtDockDepartNext"
    | "AtSeaArriveNext"
    | "AtSeaDepartNext",
    ConvexPrediction
  >
>;

export type PredictedTripComputation = TripComputation & {
  predictions: TripPredictionSet;
  finalPredictedTrip?: ConvexVesselTripWithML;
};

/**
 * Canonical persisted-row story for Stage A. The current implementation emits
 * proposal rows first and the functions layer owns compare-then-write.
 */
export type VesselTripPredictionRow = VesselTripPredictionProposal;

export type RunUpdateVesselPredictionsInput = {
  tickStartedAt: number;
  tripComputations: ReadonlyArray<TripComputation>;
  predictionContext: VesselPredictionContext;
};

export type RunUpdateVesselPredictionsOutput = {
  vesselTripPredictions: VesselTripPredictionRow[];
  predictedTripComputations: PredictedTripComputation[];
};
