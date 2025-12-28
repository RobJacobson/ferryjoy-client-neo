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
import type * as domain_index from "../domain/index.js";
import type * as domain_ml_index from "../domain/ml/index.js";
import type * as domain_ml_prediction_index from "../domain/ml/prediction/index.js";
import type * as domain_ml_prediction_predictLinearRegression from "../domain/ml/prediction/predictLinearRegression.js";
import type * as domain_ml_prediction_predictOnArrival from "../domain/ml/prediction/predictOnArrival.js";
import type * as domain_ml_prediction_predictors_index from "../domain/ml/prediction/predictors/index.js";
import type * as domain_ml_prediction_predictors_predictDelayOnArrival from "../domain/ml/prediction/predictors/predictDelayOnArrival.js";
import type * as domain_ml_prediction_predictors_predictEtaOnArrival from "../domain/ml/prediction/predictors/predictEtaOnArrival.js";
import type * as domain_ml_prediction_predictors_predictEtaOnDeparture from "../domain/ml/prediction/predictors/predictEtaOnDeparture.js";
import type * as domain_ml_prediction_predictors_shared from "../domain/ml/prediction/predictors/shared.js";
import type * as domain_ml_prediction_predictors_types from "../domain/ml/prediction/predictors/types.js";
import type * as domain_ml_shared_core_config from "../domain/ml/shared/core/config.js";
import type * as domain_ml_shared_core_index from "../domain/ml/shared/core/index.js";
import type * as domain_ml_shared_core_modelTypes from "../domain/ml/shared/core/modelTypes.js";
import type * as domain_ml_shared_core_types from "../domain/ml/shared/core/types.js";
import type * as domain_ml_shared_features_extractFeatures from "../domain/ml/shared/features/extractFeatures.js";
import type * as domain_ml_shared_features_index from "../domain/ml/shared/features/index.js";
import type * as domain_ml_shared_features_timeFeatures from "../domain/ml/shared/features/timeFeatures.js";
import type * as domain_ml_shared_functional_index from "../domain/ml/shared/functional/index.js";
import type * as domain_ml_shared_index from "../domain/ml/shared/index.js";
import type * as domain_ml_training_actions from "../domain/ml/training/actions.js";
import type * as domain_ml_training_data_createTrainingBuckets from "../domain/ml/training/data/createTrainingBuckets.js";
import type * as domain_ml_training_data_createTrainingRecords from "../domain/ml/training/data/createTrainingRecords.js";
import type * as domain_ml_training_data_index from "../domain/ml/training/data/index.js";
import type * as domain_ml_training_data_loadTrainingData from "../domain/ml/training/data/loadTrainingData.js";
import type * as domain_ml_training_index from "../domain/ml/training/index.js";
import type * as domain_ml_training_models_index from "../domain/ml/training/models/index.js";
import type * as domain_ml_training_models_loadModel from "../domain/ml/training/models/loadModel.js";
import type * as domain_ml_training_models_storeModels from "../domain/ml/training/models/storeModels.js";
import type * as domain_ml_training_models_trainModels from "../domain/ml/training/models/trainModels.js";
import type * as domain_ml_training_pipeline from "../domain/ml/training/pipeline.js";
import type * as functions_index from "../functions/index.js";
import type * as functions_predictions_index from "../functions/predictions/index.js";
import type * as functions_predictions_mutations from "../functions/predictions/mutations.js";
import type * as functions_predictions_queries from "../functions/predictions/queries.js";
import type * as functions_predictions_schemas from "../functions/predictions/schemas.js";
import type * as functions_scheduledTrips_actions from "../functions/scheduledTrips/actions.js";
import type * as functions_scheduledTrips_actions_index from "../functions/scheduledTrips/actions/index.js";
import type * as functions_scheduledTrips_actions_performSync from "../functions/scheduledTrips/actions/performSync.js";
import type * as functions_scheduledTrips_actions_shared from "../functions/scheduledTrips/actions/shared.js";
import type * as functions_scheduledTrips_actions_types from "../functions/scheduledTrips/actions/types.js";
import type * as functions_scheduledTrips_actions_validateSync from "../functions/scheduledTrips/actions/validateSync.js";
import type * as functions_scheduledTrips_index from "../functions/scheduledTrips/index.js";
import type * as functions_scheduledTrips_mutations from "../functions/scheduledTrips/mutations.js";
import type * as functions_scheduledTrips_queries from "../functions/scheduledTrips/queries.js";
import type * as functions_scheduledTrips_schemas from "../functions/scheduledTrips/schemas.js";
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
import type * as shared_durationUtils from "../shared/durationUtils.js";
import type * as shared_index from "../shared/index.js";
import type * as shared_predictionUtils from "../shared/predictionUtils.js";
import type * as shared_time from "../shared/time.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "domain/index": typeof domain_index;
  "domain/ml/index": typeof domain_ml_index;
  "domain/ml/prediction/index": typeof domain_ml_prediction_index;
  "domain/ml/prediction/predictLinearRegression": typeof domain_ml_prediction_predictLinearRegression;
  "domain/ml/prediction/predictOnArrival": typeof domain_ml_prediction_predictOnArrival;
  "domain/ml/prediction/predictors/index": typeof domain_ml_prediction_predictors_index;
  "domain/ml/prediction/predictors/predictDelayOnArrival": typeof domain_ml_prediction_predictors_predictDelayOnArrival;
  "domain/ml/prediction/predictors/predictEtaOnArrival": typeof domain_ml_prediction_predictors_predictEtaOnArrival;
  "domain/ml/prediction/predictors/predictEtaOnDeparture": typeof domain_ml_prediction_predictors_predictEtaOnDeparture;
  "domain/ml/prediction/predictors/shared": typeof domain_ml_prediction_predictors_shared;
  "domain/ml/prediction/predictors/types": typeof domain_ml_prediction_predictors_types;
  "domain/ml/shared/core/config": typeof domain_ml_shared_core_config;
  "domain/ml/shared/core/index": typeof domain_ml_shared_core_index;
  "domain/ml/shared/core/modelTypes": typeof domain_ml_shared_core_modelTypes;
  "domain/ml/shared/core/types": typeof domain_ml_shared_core_types;
  "domain/ml/shared/features/extractFeatures": typeof domain_ml_shared_features_extractFeatures;
  "domain/ml/shared/features/index": typeof domain_ml_shared_features_index;
  "domain/ml/shared/features/timeFeatures": typeof domain_ml_shared_features_timeFeatures;
  "domain/ml/shared/functional/index": typeof domain_ml_shared_functional_index;
  "domain/ml/shared/index": typeof domain_ml_shared_index;
  "domain/ml/training/actions": typeof domain_ml_training_actions;
  "domain/ml/training/data/createTrainingBuckets": typeof domain_ml_training_data_createTrainingBuckets;
  "domain/ml/training/data/createTrainingRecords": typeof domain_ml_training_data_createTrainingRecords;
  "domain/ml/training/data/index": typeof domain_ml_training_data_index;
  "domain/ml/training/data/loadTrainingData": typeof domain_ml_training_data_loadTrainingData;
  "domain/ml/training/index": typeof domain_ml_training_index;
  "domain/ml/training/models/index": typeof domain_ml_training_models_index;
  "domain/ml/training/models/loadModel": typeof domain_ml_training_models_loadModel;
  "domain/ml/training/models/storeModels": typeof domain_ml_training_models_storeModels;
  "domain/ml/training/models/trainModels": typeof domain_ml_training_models_trainModels;
  "domain/ml/training/pipeline": typeof domain_ml_training_pipeline;
  "functions/index": typeof functions_index;
  "functions/predictions/index": typeof functions_predictions_index;
  "functions/predictions/mutations": typeof functions_predictions_mutations;
  "functions/predictions/queries": typeof functions_predictions_queries;
  "functions/predictions/schemas": typeof functions_predictions_schemas;
  "functions/scheduledTrips/actions": typeof functions_scheduledTrips_actions;
  "functions/scheduledTrips/actions/index": typeof functions_scheduledTrips_actions_index;
  "functions/scheduledTrips/actions/performSync": typeof functions_scheduledTrips_actions_performSync;
  "functions/scheduledTrips/actions/shared": typeof functions_scheduledTrips_actions_shared;
  "functions/scheduledTrips/actions/types": typeof functions_scheduledTrips_actions_types;
  "functions/scheduledTrips/actions/validateSync": typeof functions_scheduledTrips_actions_validateSync;
  "functions/scheduledTrips/index": typeof functions_scheduledTrips_index;
  "functions/scheduledTrips/mutations": typeof functions_scheduledTrips_mutations;
  "functions/scheduledTrips/queries": typeof functions_scheduledTrips_queries;
  "functions/scheduledTrips/schemas": typeof functions_scheduledTrips_schemas;
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
  "shared/durationUtils": typeof shared_durationUtils;
  "shared/index": typeof shared_index;
  "shared/predictionUtils": typeof shared_predictionUtils;
  "shared/time": typeof shared_time;
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
