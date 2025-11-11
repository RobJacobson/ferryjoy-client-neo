import { api } from "@convex/_generated/api";
import type { ActionCtx } from "@convex/_generated/server";
import MLR from "ml-regression-multivariate-linear";

import { log } from "@/shared/lib/logger";

import type {
  ModelParameters,
  TrainingExample,
  TrainingResponse,
  TripPair,
} from "../types";

// ============================================================================
// STATISTICS UTILITIES
// ============================================================================

const generateRouteStatistics = (
  routeGroups: Record<string, TrainingExample[]>,
  models: (ModelParameters & { mae: number; r2: number })[]
): Record<
  string,
  {
    count: number;
    avgPrediction: number;
    stdDev: number;
    mae: number;
    r2: number;
  }
> => {
  const stats: Record<
    string,
    {
      count: number;
      avgPrediction: number;
      stdDev: number;
      mae: number;
      r2: number;
    }
  > = {};

  Object.entries(routeGroups).forEach(([routeId, examples]) => {
    const predictions = examples.map((ex) => ex.target);
    const count = predictions.length;
    const avgPrediction =
      predictions.reduce((sum, prediction) => sum + prediction, 0) / count;

    // Calculate standard deviation
    const variance =
      predictions.reduce(
        (sum, prediction) => sum + (prediction - avgPrediction) ** 2,
        0
      ) / count;
    const stdDev = Math.sqrt(variance);

    // Find corresponding model for this route
    const model = models.find((m) => m.routeId === routeId);
    const mae = model?.mae || 0;
    const r2 = model?.r2 || 0;

    stats[routeId] = { count, avgPrediction, stdDev, mae, r2 };
  });

  return stats;
};

// ============================================================================
// TRAINING UTILITIES
// ============================================================================

const groupByRoute = (
  examples: TrainingExample[],
  pairs: TripPair[]
): Record<string, TrainingExample[]> => {
  // Create a map from pair index to route for each example
  const routeMap = new Map<number, string>();

  // Build route mapping from pairs
  pairs.forEach((pair, index) => {
    routeMap.set(index, pair.routeId);
  });

  return examples.reduce(
    (acc, example, index) => {
      const route = routeMap.get(index) || "unknown";
      const group = acc[route] || [];
      group.push(example);
      acc[route] = group;
      return acc;
    },
    {} as Record<string, TrainingExample[]>
  );
};

const trainModelForRoute = (
  routeId: string,
  examples: TrainingExample[]
): ModelParameters & { mae: number; r2: number } => {
  // Extract feature names from first example
  const featureNames = Object.keys(examples[0].input);

  // Prepare data for ML library
  const x = examples.map((ex) => Object.values(ex.input));
  const y = examples.map((ex) => ex.target);

  // Train model using ml-regression-multivariate-linear
  const { coefficients, intercept } = trainLinearRegression(x, y);

  // Calculate predictions and metrics
  const predictions = x.map((features) => {
    let prediction = intercept;
    for (let i = 0; i < features.length; i++) {
      prediction += coefficients[i] * features[i];
    }
    return prediction;
  });

  // Calculate MAE (Mean Absolute Error)
  const mae =
    y.reduce((sum, actual, i) => sum + Math.abs(actual - predictions[i]), 0) /
    y.length;

  // Calculate R² (coefficient of determination)
  const yMean = y.reduce((sum, val) => sum + val, 0) / y.length;
  const ssRes = y.reduce(
    (sum, actual, i) => sum + (actual - predictions[i]) ** 2,
    0
  );
  const ssTot = y.reduce((sum, actual) => sum + (actual - yMean) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;

  return {
    coefficients,
    featureNames,
    intercept,
    routeId,
    mae,
    r2,
  };
};

/**
 * Trains linear regression using MLR library
 * This is the working implementation from the previous version
 */
const trainLinearRegression = (
  x: number[][],
  y: number[]
): { coefficients: number[]; intercept: number } => {
  // MLR expects y as 2D array
  const y2d = y.map((val) => [val]);

  const regression = new MLR(x, y2d);

  // Extract coefficients and intercept from the trained model
  // coefficients are all rows except the last one
  const coefficients = regression.weights.slice(0, -1).map((row) => row[0]);
  // intercept is the last row
  const intercept = regression.weights[regression.weights.length - 1][0];

  return { coefficients, intercept };
};

// ============================================================================
// MAIN TRAINING FUNCTION
// ============================================================================

/**
 * Trains models for each route and saves them to the database
 */
export const trainAndSave = async (
  ctx: ActionCtx,
  examples: TrainingExample[],
  pairs: TripPair[]
): Promise<TrainingResponse> => {
  log.info(`Training models for ${examples.length} examples`);

  // Group examples by route
  const routeGroups = groupByRoute(examples, pairs);
  const routes = Object.keys(routeGroups);

  // Train model for each route
  const models = routes.map((routeId) =>
    trainModelForRoute(routeId, routeGroups[routeId])
  );

  // Generate route statistics
  const routeStats = generateRouteStatistics(routeGroups, models);

  log.info(`Training models for routes: ${routes.join(", ")}`);

  // Log route statistics table
  log.info("=== ROUTE STATISTICS BREAKDOWN ===");
  log.info("Route ID      | Examples | Avg Prediction | Std Dev | MAE | R²");
  log.info("--------------|----------|----------------|---------|-----|-----");
  Object.entries(routeStats).forEach(([routeId, stats]) => {
    log.info(
      `${routeId.padEnd(13)} | ${stats.count.toString().padStart(7)} | ${stats.avgPrediction.toFixed(2).padStart(14)} | ${stats.stdDev.toFixed(2).padStart(7)} | ${stats.mae.toFixed(2).padStart(3)} | ${stats.r2.toFixed(2).padStart(3)}`
    );
  });
  log.info("=== END ROUTE STATISTICS ===");

  // Save models to database
  const savePromises = models.map((model) =>
    ctx.runMutation(
      api.functions.predictions.mutations.storeModelParametersMutation,
      {
        model: {
          routeId: model.routeId,
          modelType: "departure", // Default to departure for now
          coefficients: model.coefficients,
          featureNames: model.featureNames,
          intercept: model.intercept,
          trainingMetrics: {
            mae: model.mae,
            rmse: 0, // Placeholder values for now
            r2: model.r2,
          },
          modelVersion: "1.0.0",
          createdAt: Date.now(),
        },
      }
    )
  );

  await Promise.all(savePromises);

  log.info(`Successfully trained and saved ${models.length} models`);

  return {
    success: true,
    models,
    stats: {
      totalExamples: examples.length,
      routes,
      routeBreakdown: routeStats,
    },
  };
};
