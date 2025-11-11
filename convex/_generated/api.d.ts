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
import type * as domain_ml_actions from "../domain/ml/actions.js";
import type * as domain_ml_index from "../domain/ml/index.js";
import type * as domain_ml_pipeline_encode from "../domain/ml/pipeline/encode.js";
import type * as domain_ml_pipeline_load from "../domain/ml/pipeline/load.js";
import type * as domain_ml_pipeline_train from "../domain/ml/pipeline/train.js";
import type * as domain_ml_predict from "../domain/ml/predict.js";
import type * as domain_ml_shared from "../domain/ml/shared.js";
import type * as domain_ml_train from "../domain/ml/train.js";
import type * as domain_ml_types from "../domain/ml/types.js";
import type * as functions_activeVesselTrips_actions from "../functions/activeVesselTrips/actions.js";
import type * as functions_activeVesselTrips_index from "../functions/activeVesselTrips/index.js";
import type * as functions_activeVesselTrips_mutations from "../functions/activeVesselTrips/mutations.js";
import type * as functions_activeVesselTrips_queries from "../functions/activeVesselTrips/queries.js";
import type * as functions_activeVesselTrips_schemas from "../functions/activeVesselTrips/schemas.js";
import type * as functions_completedVesselTrips_actions from "../functions/completedVesselTrips/actions.js";
import type * as functions_completedVesselTrips_index from "../functions/completedVesselTrips/index.js";
import type * as functions_completedVesselTrips_mutations from "../functions/completedVesselTrips/mutations.js";
import type * as functions_completedVesselTrips_queries from "../functions/completedVesselTrips/queries.js";
import type * as functions_completedVesselTrips_schemas from "../functions/completedVesselTrips/schemas.js";
import type * as functions_index from "../functions/index.js";
import type * as functions_predictions_index from "../functions/predictions/index.js";
import type * as functions_predictions_mutations from "../functions/predictions/mutations.js";
import type * as functions_predictions_queries from "../functions/predictions/queries.js";
import type * as functions_predictions_schemas from "../functions/predictions/schemas.js";
import type * as functions_predictions_types from "../functions/predictions/types.js";
import type * as functions_utils from "../functions/utils.js";
import type * as functions_vesselLocation_actions from "../functions/vesselLocation/actions.js";
import type * as functions_vesselLocation_index from "../functions/vesselLocation/index.js";
import type * as functions_vesselLocation_mutations from "../functions/vesselLocation/mutations.js";
import type * as functions_vesselLocation_queries from "../functions/vesselLocation/queries.js";
import type * as functions_vesselLocation_schemas from "../functions/vesselLocation/schemas.js";
import type * as functions_vesselPings_actions from "../functions/vesselPings/actions.js";
import type * as functions_vesselPings_index from "../functions/vesselPings/index.js";
import type * as functions_vesselPings_mutations from "../functions/vesselPings/mutations.js";
import type * as functions_vesselPings_queries from "../functions/vesselPings/queries.js";
import type * as functions_vesselPings_schemas from "../functions/vesselPings/schemas.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "domain/index": typeof domain_index;
  "domain/ml/actions": typeof domain_ml_actions;
  "domain/ml/index": typeof domain_ml_index;
  "domain/ml/pipeline/encode": typeof domain_ml_pipeline_encode;
  "domain/ml/pipeline/load": typeof domain_ml_pipeline_load;
  "domain/ml/pipeline/train": typeof domain_ml_pipeline_train;
  "domain/ml/predict": typeof domain_ml_predict;
  "domain/ml/shared": typeof domain_ml_shared;
  "domain/ml/train": typeof domain_ml_train;
  "domain/ml/types": typeof domain_ml_types;
  "functions/activeVesselTrips/actions": typeof functions_activeVesselTrips_actions;
  "functions/activeVesselTrips/index": typeof functions_activeVesselTrips_index;
  "functions/activeVesselTrips/mutations": typeof functions_activeVesselTrips_mutations;
  "functions/activeVesselTrips/queries": typeof functions_activeVesselTrips_queries;
  "functions/activeVesselTrips/schemas": typeof functions_activeVesselTrips_schemas;
  "functions/completedVesselTrips/actions": typeof functions_completedVesselTrips_actions;
  "functions/completedVesselTrips/index": typeof functions_completedVesselTrips_index;
  "functions/completedVesselTrips/mutations": typeof functions_completedVesselTrips_mutations;
  "functions/completedVesselTrips/queries": typeof functions_completedVesselTrips_queries;
  "functions/completedVesselTrips/schemas": typeof functions_completedVesselTrips_schemas;
  "functions/index": typeof functions_index;
  "functions/predictions/index": typeof functions_predictions_index;
  "functions/predictions/mutations": typeof functions_predictions_mutations;
  "functions/predictions/queries": typeof functions_predictions_queries;
  "functions/predictions/schemas": typeof functions_predictions_schemas;
  "functions/predictions/types": typeof functions_predictions_types;
  "functions/utils": typeof functions_utils;
  "functions/vesselLocation/actions": typeof functions_vesselLocation_actions;
  "functions/vesselLocation/index": typeof functions_vesselLocation_index;
  "functions/vesselLocation/mutations": typeof functions_vesselLocation_mutations;
  "functions/vesselLocation/queries": typeof functions_vesselLocation_queries;
  "functions/vesselLocation/schemas": typeof functions_vesselLocation_schemas;
  "functions/vesselPings/actions": typeof functions_vesselPings_actions;
  "functions/vesselPings/index": typeof functions_vesselPings_index;
  "functions/vesselPings/mutations": typeof functions_vesselPings_mutations;
  "functions/vesselPings/queries": typeof functions_vesselPings_queries;
  "functions/vesselPings/schemas": typeof functions_vesselPings_schemas;
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
