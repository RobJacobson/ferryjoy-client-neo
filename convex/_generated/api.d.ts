/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as domain_ml_actions from "../domain/ml/actions.js";
import type * as domain_ml_index from "../domain/ml/index.js";
import type * as domain_ml_pipeline_orchestrator from "../domain/ml/pipeline/orchestrator.js";
import type * as domain_ml_pipeline_shared_config from "../domain/ml/pipeline/shared/config.js";
import type * as domain_ml_pipeline_shared_logging from "../domain/ml/pipeline/shared/logging.js";
import type * as domain_ml_pipeline_shared_performance from "../domain/ml/pipeline/shared/performance.js";
import type * as domain_ml_pipeline_shared_types from "../domain/ml/pipeline/shared/types.js";
import type * as domain_ml_pipeline_shared_validation from "../domain/ml/pipeline/shared/validation.js";
import type * as domain_ml_pipeline_step_1_loadAllTrips from "../domain/ml/pipeline/step_1_loadAllTrips.js";
import type * as domain_ml_pipeline_step_1a_loadAllConvexTrips from "../domain/ml/pipeline/step_1a_loadAllConvexTrips.js";
import type * as domain_ml_pipeline_step_1b_loadAllWSFTrips from "../domain/ml/pipeline/step_1b_loadAllWSFTrips.js";
import type * as domain_ml_pipeline_step_2_filterAndConvert from "../domain/ml/pipeline/step_2_filterAndConvert.js";
import type * as domain_ml_pipeline_step_3_bucketByTerminalPairs from "../domain/ml/pipeline/step_3_bucketByTerminalPairs.js";
import type * as domain_ml_pipeline_step_4_createTrainingData from "../domain/ml/pipeline/step_4_createTrainingData.js";
import type * as domain_ml_pipeline_step_5_trainBuckets from "../domain/ml/pipeline/step_5_trainBuckets.js";
import type * as domain_ml_pipeline_step_6_storeResults from "../domain/ml/pipeline/step_6_storeResults.js";
import type * as domain_ml_predict from "../domain/ml/predict.js";
import type * as domain_ml_shared from "../domain/ml/shared.js";
import type * as domain_ml_temp from "../domain/ml/temp.js";
import type * as domain_ml_types from "../domain/ml/types.js";
import type * as functions_index from "../functions/index.js";
import type * as functions_predictions_index from "../functions/predictions/index.js";
import type * as functions_predictions_mutations from "../functions/predictions/mutations.js";
import type * as functions_predictions_queries from "../functions/predictions/queries.js";
import type * as functions_predictions_schemas from "../functions/predictions/schemas.js";
import type * as functions_utils from "../functions/utils.js";
import type * as functions_vesselLocation_actions from "../functions/vesselLocation/actions.js";
import type * as functions_vesselLocation_index from "../functions/vesselLocation/index.js";
import type * as functions_vesselLocation_mutations from "../functions/vesselLocation/mutations.js";
import type * as functions_vesselLocation_queries from "../functions/vesselLocation/queries.js";
import type * as functions_vesselLocation_schemas from "../functions/vesselLocation/schemas.js";
import type * as functions_vesselPing_actions from "../functions/vesselPing/actions.js";
import type * as functions_vesselPing_index from "../functions/vesselPing/index.js";
import type * as functions_vesselPing_mutations from "../functions/vesselPing/mutations.js";
import type * as functions_vesselPing_queries from "../functions/vesselPing/queries.js";
import type * as functions_vesselPing_schemas from "../functions/vesselPing/schemas.js";
import type * as functions_vesselPings_actions from "../functions/vesselPings/actions.js";
import type * as functions_vesselPings_index from "../functions/vesselPings/index.js";
import type * as functions_vesselPings_mutations from "../functions/vesselPings/mutations.js";
import type * as functions_vesselPings_queries from "../functions/vesselPings/queries.js";
import type * as functions_vesselPings_schemas from "../functions/vesselPings/schemas.js";
import type * as functions_vesselTrips_actions from "../functions/vesselTrips/actions.js";
import type * as functions_vesselTrips_index from "../functions/vesselTrips/index.js";
import type * as functions_vesselTrips_mutations from "../functions/vesselTrips/mutations.js";
import type * as functions_vesselTrips_queries from "../functions/vesselTrips/queries.js";
import type * as functions_vesselTrips_schemas from "../functions/vesselTrips/schemas.js";
import type * as shared_convertDates from "../shared/convertDates.js";
import type * as shared_convertVesselLocations from "../shared/convertVesselLocations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "domain/ml/actions": typeof domain_ml_actions;
  "domain/ml/index": typeof domain_ml_index;
  "domain/ml/pipeline/orchestrator": typeof domain_ml_pipeline_orchestrator;
  "domain/ml/pipeline/shared/config": typeof domain_ml_pipeline_shared_config;
  "domain/ml/pipeline/shared/logging": typeof domain_ml_pipeline_shared_logging;
  "domain/ml/pipeline/shared/performance": typeof domain_ml_pipeline_shared_performance;
  "domain/ml/pipeline/shared/types": typeof domain_ml_pipeline_shared_types;
  "domain/ml/pipeline/shared/validation": typeof domain_ml_pipeline_shared_validation;
  "domain/ml/pipeline/step_1_loadAllTrips": typeof domain_ml_pipeline_step_1_loadAllTrips;
  "domain/ml/pipeline/step_1a_loadAllConvexTrips": typeof domain_ml_pipeline_step_1a_loadAllConvexTrips;
  "domain/ml/pipeline/step_1b_loadAllWSFTrips": typeof domain_ml_pipeline_step_1b_loadAllWSFTrips;
  "domain/ml/pipeline/step_2_filterAndConvert": typeof domain_ml_pipeline_step_2_filterAndConvert;
  "domain/ml/pipeline/step_3_bucketByTerminalPairs": typeof domain_ml_pipeline_step_3_bucketByTerminalPairs;
  "domain/ml/pipeline/step_4_createTrainingData": typeof domain_ml_pipeline_step_4_createTrainingData;
  "domain/ml/pipeline/step_5_trainBuckets": typeof domain_ml_pipeline_step_5_trainBuckets;
  "domain/ml/pipeline/step_6_storeResults": typeof domain_ml_pipeline_step_6_storeResults;
  "domain/ml/predict": typeof domain_ml_predict;
  "domain/ml/shared": typeof domain_ml_shared;
  "domain/ml/temp": typeof domain_ml_temp;
  "domain/ml/types": typeof domain_ml_types;
  "functions/index": typeof functions_index;
  "functions/predictions/index": typeof functions_predictions_index;
  "functions/predictions/mutations": typeof functions_predictions_mutations;
  "functions/predictions/queries": typeof functions_predictions_queries;
  "functions/predictions/schemas": typeof functions_predictions_schemas;
  "functions/utils": typeof functions_utils;
  "functions/vesselLocation/actions": typeof functions_vesselLocation_actions;
  "functions/vesselLocation/index": typeof functions_vesselLocation_index;
  "functions/vesselLocation/mutations": typeof functions_vesselLocation_mutations;
  "functions/vesselLocation/queries": typeof functions_vesselLocation_queries;
  "functions/vesselLocation/schemas": typeof functions_vesselLocation_schemas;
  "functions/vesselPing/actions": typeof functions_vesselPing_actions;
  "functions/vesselPing/index": typeof functions_vesselPing_index;
  "functions/vesselPing/mutations": typeof functions_vesselPing_mutations;
  "functions/vesselPing/queries": typeof functions_vesselPing_queries;
  "functions/vesselPing/schemas": typeof functions_vesselPing_schemas;
  "functions/vesselPings/actions": typeof functions_vesselPings_actions;
  "functions/vesselPings/index": typeof functions_vesselPings_index;
  "functions/vesselPings/mutations": typeof functions_vesselPings_mutations;
  "functions/vesselPings/queries": typeof functions_vesselPings_queries;
  "functions/vesselPings/schemas": typeof functions_vesselPings_schemas;
  "functions/vesselTrips/actions": typeof functions_vesselTrips_actions;
  "functions/vesselTrips/index": typeof functions_vesselTrips_index;
  "functions/vesselTrips/mutations": typeof functions_vesselTrips_mutations;
  "functions/vesselTrips/queries": typeof functions_vesselTrips_queries;
  "functions/vesselTrips/schemas": typeof functions_vesselTrips_schemas;
  "shared/convertDates": typeof shared_convertDates;
  "shared/convertVesselLocations": typeof shared_convertVesselLocations;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
