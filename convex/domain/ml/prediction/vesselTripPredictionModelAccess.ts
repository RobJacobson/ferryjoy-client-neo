/**
 * Read-only port for loading production ML model parameters during vessel-trip
 * prediction. Implemented in the functions layer (Convex `runQuery`); domain
 * code depends only on this interface, not on `ActionCtx`.
 */

import type { ModelType } from "../shared/types";

/**
 * Trained model document shape used at inference (matches stored parameters).
 */
export type ProductionModelParameters = {
  featureKeys: string[];
  coefficients: number[];
  intercept: number;
  testMetrics: {
    mae: number;
    stdDev: number;
  };
};

/**
 * Loads production model parameters for vessel-trip ticks (orchestrator path).
 *
 * @remarks
 * Mutations that need direct `db` access continue to use {@link ../predictTrip}
 * helpers that accept `MutationCtx` instead of this port.
 * Do **not** add a `db` (or similar) field to this shape: `predictTrip` uses
 * `"db" in source` to distinguish Convex `MutationCtx` from this port.
 */
export type VesselTripPredictionModelAccess = {
  /**
   * Loads one production model for a terminal pair and model type.
   *
   * @param pairKey - Route key (e.g. `BBI->P52`)
   * @param modelType - Which prediction head to load
   * @returns Model parameters or null if missing
   */
  loadModelForProductionPair: (
    pairKey: string,
    modelType: ModelType
  ) => Promise<ProductionModelParameters | null>;

  /**
   * Batches production model loads for one pair (same as batch query today).
   *
   * @param pairKey - Route key
   * @param modelTypes - Model types to load together
   * @returns Map of model type to doc or null
   */
  loadModelsForProductionPairBatch: (
    pairKey: string,
    modelTypes: ModelType[]
  ) => Promise<Record<ModelType, ProductionModelParameters | null>>;
};
