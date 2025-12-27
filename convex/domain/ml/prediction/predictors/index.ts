// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */
// PREDICTION ORCHESTRATOR
// Generic prediction flow with strategy pattern for model-specific logic
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { formatTerminalPairKey } from "../../training/shared/config";
import type { FeatureRecord } from "../step_1_extractFeatures";
import {
  extractArriveDepartFeatures,
  extractDepartArriveFeatures,
} from "../step_1_extractFeatures";
import { loadModel } from "../step_2_loadModel";
import {
  applyLinearRegression,
  atSeaDurationToEtaPred,
  combinedDurationToEtaPred,
  delayToLeftDockPred,
  roundMae,
  validatePredictionTime,
} from "../step_3_makePrediction";

// ============================================================================
// GENERIC PREDICTION CONFIGURATION AND TYPES
// ============================================================================

/**
 * Generic prediction configuration
 */
type PredictionConfig<TContext> = {
  modelName:
    | "arrive-depart-delay"
    | "arrive-arrive-total-duration"
    | "depart-arrive-atsea-duration";
  skipPrediction: (ctx: TContext) => boolean;
  extractFeatures: (ctx: TContext) => {
    features: FeatureRecord;
    error?: string;
  };
  convertToAbsolute: (
    predictedDuration: number,
    ctx: TContext
  ) => { absoluteTime: number; referenceTime: number; minimumGap?: number };
};

/**
 * Prediction result
 */
export type PredictionResult = {
  predictedTime?: number;
  mae?: number;
  skipped: boolean;
  skipReason?: string;
};

/**
 * Generic prediction orchestrator
 * Reduces code duplication across all predictors
 */
const predict = async (
  ctx: ActionCtx | MutationCtx,
  config: PredictionConfig<any>
): Promise<PredictionResult> => {
  // Step 1: Skip prediction if insufficient data
  if (config.skipPrediction(ctx)) {
    return {
      skipped: true,
      skipReason: "Insufficient context data",
    };
  }

  // Step 2: Extract features
  const { features, error } = config.extractFeatures(ctx);
  if (error) {
    console.warn(`Feature extraction failed: ${error}`);
    return {
      skipped: true,
      skipReason: error,
    };
  }

  // Step 3: Load model
  const model = await loadModel(
    ctx,
    (ctx as any).departingTerminal,
    (ctx as any).arrivingTerminal,
    config.modelName
  );

  if (!model) {
    return {
      skipped: true,
      skipReason: "Model not found",
    };
  }

  // Step 4: Make prediction
  const predictedDuration = applyLinearRegression(model, features);

  // Step 5: Convert to absolute time
  const { absoluteTime, referenceTime, minimumGap } = config.convertToAbsolute(
    predictedDuration,
    ctx
  );

  // Step 6: Validate and clamp
  const validatedTime = validatePredictionTime(
    absoluteTime,
    referenceTime,
    minimumGap
  );

  // Step 7: Extract margin
  const mae = roundMae(model.trainingMetrics.mae);

  return {
    predictedTime: validatedTime,
    mae,
    skipped: false,
  };
};

// ============================================================================
// CONTEXT TYPES FOR EACH PREDICTION TYPE
// ============================================================================

/**
 * Common terminal properties for all prediction contexts
 */
type TerminalContext = {
  departingTerminal: string;
  arrivingTerminal: string;
};

/**
 * Context for predictions when a new trip starts
 */
type NewTripContext = TerminalContext & {
  completedTrip: ConvexVesselTrip;
  newTrip: ConvexVesselTrip;
};

/**
 * Context for ETA prediction when vessel leaves dock
 */
type DepartureContext = TerminalContext & {
  currentTrip: ConvexVesselTrip;
  currentLocation: ConvexVesselLocation;
};

// ============================================================================
// LEFT DOCK PREDICTION (arrive-depart-delay model)
// ============================================================================

/**
 * Predict LeftDockPred when a new trip starts
 * Uses arrive-depart-delay model to predict departure delay
 */
export const predictLeftDock = async (
  ctx: ActionCtx | MutationCtx,
  completedTrip: ConvexVesselTrip,
  newTrip: ConvexVesselTrip
): Promise<PredictionResult> => {
  const _predictionContext: NewTripContext = {
    completedTrip,
    newTrip,
    departingTerminal: newTrip.DepartingTerminalAbbrev,
    arrivingTerminal: newTrip.ArrivingTerminalAbbrev || "",
  };

  const config: PredictionConfig<NewTripContext> = {
    modelName: "arrive-depart-delay",
    skipPrediction: (_ctx) =>
      !_ctx.completedTrip.Delay ||
      !_ctx.completedTrip.AtSeaDuration ||
      !_ctx.newTrip.TripStart ||
      !_ctx.newTrip.ScheduledDeparture,
    extractFeatures: (_ctx) => {
      const terminalPairKey = formatTerminalPairKey(
        _ctx.departingTerminal,
        _ctx.arrivingTerminal
      );
      try {
        const features = extractArriveDepartFeatures(
          _ctx.newTrip.ScheduledDeparture!,
          _ctx.completedTrip.Delay!,
          _ctx.completedTrip.AtSeaDuration!,
          _ctx.newTrip.TripStart!,
          terminalPairKey
        );
        return { features };
      } catch (error) {
        return { features: {}, error: String(error) };
      }
    },
    convertToAbsolute: (predictedDuration, ctx) => ({
      absoluteTime: delayToLeftDockPred(
        ctx.newTrip.TripStart!,
        predictedDuration
      ),
      referenceTime: ctx.newTrip.TripStart!,
      minimumGap: 2,
    }),
  };

  return predict(ctx, config);
};

// ============================================================================
// ETA PREDICTION ON NEW TRIP (arrive-arrive-total-duration model)
// ============================================================================

/**
 * Predict EtaPred when a new trip starts
 * Uses arrive-arrive-total-duration model to predict total arrival time
 */
export const predictEta = async (
  ctx: ActionCtx | MutationCtx,
  completedTrip: ConvexVesselTrip,
  newTrip: ConvexVesselTrip
): Promise<PredictionResult> => {
  const _predictionContext: NewTripContext = {
    completedTrip,
    newTrip,
    departingTerminal: newTrip.DepartingTerminalAbbrev,
    arrivingTerminal: newTrip.ArrivingTerminalAbbrev || "",
  };

  const config: PredictionConfig<NewTripContext> = {
    modelName: "arrive-arrive-total-duration",
    skipPrediction: (_ctx) =>
      !_ctx.completedTrip.Delay ||
      !_ctx.completedTrip.AtSeaDuration ||
      !_ctx.newTrip.TripStart ||
      !_ctx.newTrip.ScheduledDeparture,
    extractFeatures: (_ctx) => {
      const terminalPairKey = formatTerminalPairKey(
        _ctx.departingTerminal,
        _ctx.arrivingTerminal
      );
      try {
        const features = extractArriveDepartFeatures(
          _ctx.newTrip.ScheduledDeparture!,
          _ctx.completedTrip.Delay!,
          _ctx.completedTrip.AtSeaDuration!,
          _ctx.newTrip.TripStart!,
          terminalPairKey
        );
        return { features };
      } catch (error) {
        return { features: {}, error: String(error) };
      }
    },
    convertToAbsolute: (predictedDuration, ctx) => ({
      absoluteTime: combinedDurationToEtaPred(
        ctx.newTrip.TripStart!,
        predictedDuration
      ),
      referenceTime: ctx.newTrip.TripStart!,
      minimumGap: 2,
    }),
  };

  return predict(ctx, config);
};

// ============================================================================
// ETA UPDATE ON DEPARTURE (depart-arrive-atsea-duration model)
// ============================================================================

/**
 * Update EtaPred when vessel leaves dock
 * Uses depart-arrive-atsea-duration model with actual at-dock duration
 */
export const updateEtaOnDeparture = async (
  ctx: ActionCtx | MutationCtx,
  currentTrip: ConvexVesselTrip,
  currentLocation: ConvexVesselLocation
): Promise<PredictionResult> => {
  const _predictionContext: DepartureContext = {
    currentTrip,
    currentLocation,
    departingTerminal: currentTrip.DepartingTerminalAbbrev,
    arrivingTerminal: currentTrip.ArrivingTerminalAbbrev || "",
  };

  const config: PredictionConfig<DepartureContext> = {
    modelName: "depart-arrive-atsea-duration",
    skipPrediction: (ctx) =>
      !ctx.currentLocation.LeftDock ||
      !ctx.currentTrip.AtDockDuration ||
      !ctx.currentTrip.Delay ||
      !ctx.currentTrip.ScheduledDeparture,
    extractFeatures: (ctx) => {
      try {
        const features = extractDepartArriveFeatures(
          ctx.currentTrip.ScheduledDeparture,
          ctx.currentTrip.AtDockDuration,
          ctx.currentTrip.Delay
        );
        return { features };
      } catch (error) {
        return { features: {}, error: String(error) };
      }
    },
    convertToAbsolute: (predictedDuration, _ctx) => ({
      absoluteTime: atSeaDurationToEtaPred(
        _ctx.currentLocation.LeftDock!,
        predictedDuration
      ),
      referenceTime: _ctx.currentLocation.LeftDock!,
      minimumGap: 2,
    }),
  };

  return predict(ctx, config);
};
