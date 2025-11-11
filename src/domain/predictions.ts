import type {
  ConvexCurrentPredictionData,
  ConvexHistoricalPredictionData,
  ConvexModelParameters,
} from "../../convex/functions/predictions/schemas";
import type { DateFieldsToDate } from "./transformers";
import { toDomain, toStorage } from "./transformers";

// Re-export the inferred types from convex with domain-appropriate naming

// Define date fields as a const array - TypeScript will infer the union type
const CURRENT_PREDICTION_DATE_FIELDS = [
  "createdAt",
  "schedDep",
  "predictedTime",
] as const;

const HISTORICAL_PREDICTION_DATE_FIELDS = [
  "createdAt",
  "schedDep",
  "predictedTime",
  "predictionTimestamp",
] as const;

const MODEL_PARAMETERS_DATE_FIELDS = ["createdAt"] as const;

// Extract the union types from the const arrays
type CurrentPredictionDateFields =
  (typeof CURRENT_PREDICTION_DATE_FIELDS)[number];
type HistoricalPredictionDateFields =
  (typeof HISTORICAL_PREDICTION_DATE_FIELDS)[number];
type ModelParametersDateFields = (typeof MODEL_PARAMETERS_DATE_FIELDS)[number];

/**
 * Domain model for current prediction data with Dates and nullable fields.
 * Generated from storage type with proper null handling and Date objects
 */
export type CurrentPredictionData = DateFieldsToDate<
  ConvexCurrentPredictionData,
  CurrentPredictionDateFields
>;

/**
 * Domain model for historical prediction data with Dates and nullable fields.
 * Generated from storage type with proper null handling and Date objects
 */
export type HistoricalPredictionData = DateFieldsToDate<
  ConvexHistoricalPredictionData,
  HistoricalPredictionDateFields
>;

/**
 * Domain model for model parameters with Dates and nullable fields.
 * Generated from storage type with proper null handling and Date objects
 */
export type ModelParameters = DateFieldsToDate<
  ConvexModelParameters,
  ModelParametersDateFields
>;

/**
 * Convert storage representation (Convex) to domain representation for current predictions.
 */
// export const fromConvexCurrentPredictionData = (
//   convexCurrentPredictionData: ConvexCurrentPredictionData
// ): CurrentPredictionData =>
//   toDomain(
//     convexCurrentPredictionData,
//     CURRENT_PREDICTION_DATE_FIELDS
//   ) as unknown as CurrentPredictionData;

/**
 * Convert domain representation to storage representation (Convex) for current predictions.
 */
// export const toConvexCurrentPredictionData = (
//   currentPredictionData: CurrentPredictionData
// ): ConvexCurrentPredictionData =>
//   toStorage(
//     currentPredictionData,
//     CURRENT_PREDICTION_DATE_FIELDS
//   ) as unknown as ConvexCurrentPredictionData;

/**
 * Convert storage representation (Convex) to domain representation for historical predictions.
 */
// export const fromConvexHistoricalPredictionData = (
//   convexHistoricalPredictionData: ConvexHistoricalPredictionData
// ): HistoricalPredictionData =>
//   toDomain(
//     convexHistoricalPredictionData,
//     HISTORICAL_PREDICTION_DATE_FIELDS
//   ) as unknown as HistoricalPredictionData;

/**
 * Convert domain representation to storage representation (Convex) for historical predictions.
 */
// export const toConvexHistoricalPredictionData = (
//   historicalPredictionData: HistoricalPredictionData
// ): ConvexHistoricalPredictionData =>
//   toStorage(
//     historicalPredictionData,
//     HISTORICAL_PREDICTION_DATE_FIELDS
//   ) as unknown as ConvexHistoricalPredictionData;

/**
 * Convert storage representation (Convex) to domain representation for model parameters.
 */
// export const fromConvexModelParameters = (
//   convexModelParameters: ConvexModelParameters
// ): ModelParameters =>
//   toDomain(
//     convexModelParameters,
//     MODEL_PARAMETERS_DATE_FIELDS
//   ) as unknown as ModelParameters;

/**
 * Convert domain representation to storage representation (Convex) for model parameters.
 */
// export const toConvexModelParameters = (
//   modelParameters: ModelParameters
// ): ConvexModelParameters =>
//   toStorage(
//     modelParameters,
//     MODEL_PARAMETERS_DATE_FIELDS
//   ) as unknown as ConvexModelParameters;
