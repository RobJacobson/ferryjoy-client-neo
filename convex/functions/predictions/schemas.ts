import type { Infer } from "convex/values";
import { v } from "convex/values";
// import {
//   dateToEpochMs,
//   epochMsToDate,
//   optionalDateToEpochMs,
//   optionalEpochMsToDate,
// } from "../../shared/dateConversion";

// /**
//  * Convex validator for current prediction data (numbers)
//  * Single table with type discriminator
//  */
// export const currentPredictionDataSchema = v.object({
//   vesselId: v.number(),
//   predictionType: v.union(v.literal("departure"), v.literal("arrival")),
//   vesselName: v.string(),
//   opRouteAbrv: v.string(),
//   depTermAbrv: v.string(),
//   arvTermAbrv: v.string(),
//   createdAt: v.number(),
//   schedDep: v.number(),
//   predictedTime: v.number(),
//   confidence: v.number(),
//   modelVersion: v.string(),
// });

// /**
//  * Type for current prediction data in Convex storage (with numbers)
//  * Inferred from the Convex validator
//  */
// export type ConvexCurrentPredictionData = Infer<
//   typeof currentPredictionDataSchema
// >;

// /**
//  * Convex validator for historical predictions analysis (numbers)
//  */
// export const historicalPredictionDataSchema = v.object({
//   vesselId: v.number(),
//   predictionType: v.union(v.literal("departure"), v.literal("arrival")),
//   vesselName: v.string(),
//   opRouteAbrv: v.string(),
//   depTermAbrv: v.string(),
//   arvTermAbrv: v.string(),
//   modelVersion: v.string(),
//   createdAt: v.number(),
//   schedDep: v.number(),
//   predictedTime: v.number(),
//   confidence: v.number(),
//   predictionId: v.string(),
//   predictionTimestamp: v.number(),
//   hourOfDay: v.number(),
//   dayType: v.union(v.literal("weekday"), v.literal("weekend")),
//   previousDelay: v.number(),
//   priorTime: v.number(),
//   actual: v.optional(v.number()),
//   error: v.optional(v.number()),
// });

// /**
//  * Type for historical prediction data in Convex storage (with numbers)
//  * Inferred from the Convex validator
//  */
// export type ConvexHistoricalPredictionData = Infer<
//   typeof historicalPredictionDataSchema
// >;

// /**
//  * Type for historical prediction data in domain layer (with Date objects)
//  * Inferred from the return type of our conversion function
//  */
// export type HistoricalPredictionData = ReturnType<
//   typeof toDomainHistoricalPredictionData
// >;

/**
 * Convex validator for model parameters mutation argument (numbers)
 */
export const modelParametersMutationSchema = v.object({
  departingTerminalAbbrev: v.string(),
  arrivingTerminalAbbrev: v.string(),
  modelType: v.union(
    v.literal("arrive-depart-atdock-duration"),
    v.literal("arrive-depart-delay"),
    v.literal("depart-arrive-atsea-duration"),
    v.literal("arrive-arrive-total-duration"),
    v.literal("depart-depart-total-duration")
  ),

  // Model parameters (optional for insufficient data cases)
  coefficients: v.optional(v.array(v.number())),
  intercept: v.optional(v.number()),
  trainingMetrics: v.optional(
    v.object({
      mae: v.number(),
      rmse: v.number(),
      r2: v.number(),
      stdDev: v.optional(v.number()),
    })
  ),

  // Required metadata
  createdAt: v.number(),

  // Bucket statistics (optional for backward compatibility)
  bucketStats: v.optional(
    v.object({
      totalRecords: v.number(),
      filteredRecords: v.number(),
      meanDepartureDelay: v.optional(v.number()),
      meanAtSeaDuration: v.optional(v.number()),
      meanDelay: v.optional(v.number()),
      // Backward compatibility for old data
      meanAtDockDuration: v.optional(v.number()),
    })
  ),
});

/**
 * Type for model parameters in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexModelParameters = Infer<typeof modelParametersMutationSchema>;

// /**
//  * Convert Convex current prediction data (numbers) to domain current prediction data (Dates)
//  * Manual conversion from epoch milliseconds to Date objects
//  */
// export const toDomainCurrentPredictionData = (
//   data: ConvexCurrentPredictionData
// ) => ({
//   vesselId: data.vesselId,
//   predictionType: data.predictionType,
//   vesselName: data.vesselName,
//   opRouteAbrv: data.opRouteAbrv,
//   depTermAbrv: data.depTermAbrv,
//   arvTermAbrv: data.arvTermAbrv,
//   createdAt: epochMsToDate(data.createdAt),
//   schedDep: epochMsToDate(data.schedDep),
//   predictedTime: epochMsToDate(data.predictedTime),
//   confidence: data.confidence,
//   modelVersion: data.modelVersion,
// });

// /**
//  * Convert domain current prediction data (Dates) to Convex current prediction data (numbers)
//  * Manual conversion from Date objects to epoch milliseconds
//  */
// export const toConvexCurrentPredictionData = (data: CurrentPredictionData) => ({
//   vesselId: data.vesselId,
//   predictionType: data.predictionType,
//   vesselName: data.vesselName,
//   opRouteAbrv: data.opRouteAbrv,
//   depTermAbrv: data.depTermAbrv,
//   arvTermAbrv: data.arvTermAbrv,
//   createdAt: dateToEpochMs(data.createdAt),
//   schedDep: dateToEpochMs(data.schedDep),
//   predictedTime: dateToEpochMs(data.predictedTime),
//   confidence: data.confidence,
//   modelVersion: data.modelVersion,
// });

// /**
//  * Convert Convex historical prediction data (numbers) to domain historical prediction data (Dates)
//  * Manual conversion from epoch milliseconds to Date objects
//  */
// export const toDomainHistoricalPredictionData = (
//   data: ConvexHistoricalPredictionData
// ) => ({
//   vesselId: data.vesselId,
//   predictionType: data.predictionType,
//   vesselName: data.vesselName,
//   opRouteAbrv: data.opRouteAbrv,
//   depTermAbrv: data.depTermAbrv,
//   arvTermAbrv: data.arvTermAbrv,
//   modelVersion: data.modelVersion,
//   createdAt: epochMsToDate(data.createdAt),
//   schedDep: epochMsToDate(data.schedDep),
//   predictedTime: epochMsToDate(data.predictedTime),
//   confidence: data.confidence,
//   predictionId: data.predictionId,
//   predictionTimestamp: epochMsToDate(data.predictionTimestamp),
//   hourOfDay: data.hourOfDay,
//   dayType: data.dayType,
//   previousDelay: data.previousDelay,
//   priorTime: epochMsToDate(data.priorTime),
//   actual: optionalEpochMsToDate(data.actual),
//   error: data.error,
// });

// /**
//  * Type for current prediction data in domain layer (with Date objects)
//  * Inferred from the return type of our conversion function
//  */
// export type CurrentPredictionData = ReturnType<
//   typeof toDomainCurrentPredictionData
// >;

// /**
//  * Convert domain historical prediction data (Dates) to Convex historical prediction data (numbers)
//  * Manual conversion from Date objects to epoch milliseconds
//  */
// export const toConvexHistoricalPredictionData = (
//   data: HistoricalPredictionData
// ) => ({
//   vesselId: data.vesselId,
//   predictionType: data.predictionType,
//   vesselName: data.vesselName,
//   opRouteAbrv: data.opRouteAbrv,
//   depTermAbrv: data.depTermAbrv,
//   arvTermAbrv: data.arvTermAbrv,
//   modelVersion: data.modelVersion,
//   createdAt: dateToEpochMs(data.createdAt),
//   schedDep: dateToEpochMs(data.schedDep),
//   predictedTime: dateToEpochMs(data.predictedTime),
//   confidence: data.confidence,
//   predictionId: data.predictionId,
//   predictionTimestamp: dateToEpochMs(data.predictionTimestamp),
//   hourOfDay: data.hourOfDay,
//   dayType: data.dayType,
//   previousDelay: data.previousDelay,
//   priorTime: dateToEpochMs(data.priorTime),
//   actual: optionalDateToEpochMs(data.actual),
//   error: data.error,
// });

// /**
//  * Convert Convex model parameters (numbers) to domain model parameters (Dates)
//  * Manual conversion from epoch milliseconds to Date objects
//  */
// export const toDomainModelParameters = (params: ConvexModelParameters) => ({
//   routeId: params.routeId,
//   modelType: params.modelType,
//   modelAlgorithm: params.modelAlgorithm,
//   coefficients: params.coefficients,
//   intercept: params.intercept,
//   featureNames: params.featureNames,
//   trainingMetrics: params.trainingMetrics,
//   modelVersion: params.modelVersion,
//   createdAt: epochMsToDate(params.createdAt),
// });

// /**
//  * Type for model parameters in domain layer (with Date objects)
//  * Inferred from the return type of our conversion function
//  */
// export type ModelParameters = ReturnType<typeof toDomainModelParameters>;

// /**
//  * Convert domain model parameters (Dates) to Convex model parameters (numbers)
//  * Manual conversion from Date objects to epoch milliseconds
//  */
// export const toConvexModelParameters = (
//   params: ModelParameters
// ): ConvexModelParameters => ({
//   routeId: params.routeId,
//   modelType: params.modelType,
//   modelAlgorithm: params.modelAlgorithm,
//   coefficients: params.coefficients,
//   intercept: params.intercept,
//   featureNames: params.featureNames,
//   trainingMetrics: params.trainingMetrics,
//   modelVersion: params.modelVersion,
//   createdAt: dateToEpochMs(params.createdAt),
// });
