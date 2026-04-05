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
import type * as domain_ml_prediction_applyModel from "../domain/ml/prediction/applyModel.js";
import type * as domain_ml_prediction_index from "../domain/ml/prediction/index.js";
import type * as domain_ml_prediction_metrics from "../domain/ml/prediction/metrics.js";
import type * as domain_ml_prediction_predictTrip from "../domain/ml/prediction/predictTrip.js";
import type * as domain_ml_prediction_predictionService from "../domain/ml/prediction/predictionService.js";
import type * as domain_ml_prediction_vesselTripPredictions from "../domain/ml/prediction/vesselTripPredictions.js";
import type * as domain_ml_shared_config from "../domain/ml/shared/config.js";
import type * as domain_ml_shared_featureRecord from "../domain/ml/shared/featureRecord.js";
import type * as domain_ml_shared_features from "../domain/ml/shared/features.js";
import type * as domain_ml_shared_index from "../domain/ml/shared/index.js";
import type * as domain_ml_shared_models from "../domain/ml/shared/models.js";
import type * as domain_ml_shared_types from "../domain/ml/shared/types.js";
import type * as domain_ml_shared_unifiedTrip from "../domain/ml/shared/unifiedTrip.js";
import type * as domain_ml_training_actions from "../domain/ml/training/actions.js";
import type * as domain_ml_training_data_createTrainingBuckets from "../domain/ml/training/data/createTrainingBuckets.js";
import type * as domain_ml_training_data_createTrainingWindows from "../domain/ml/training/data/createTrainingWindows.js";
import type * as domain_ml_training_data_index from "../domain/ml/training/data/index.js";
import type * as domain_ml_training_data_loadTrainingData from "../domain/ml/training/data/loadTrainingData.js";
import type * as domain_ml_training_index from "../domain/ml/training/index.js";
import type * as domain_ml_training_models_index from "../domain/ml/training/models/index.js";
import type * as domain_ml_training_models_storeModels from "../domain/ml/training/models/storeModels.js";
import type * as domain_ml_training_models_trainModels from "../domain/ml/training/models/trainModels.js";
import type * as domain_ml_training_pipeline from "../domain/ml/training/pipeline.js";
import type * as domain_vesselTimeline_events_history from "../domain/vesselTimeline/events/history.js";
import type * as domain_vesselTimeline_events_index from "../domain/vesselTimeline/events/index.js";
import type * as domain_vesselTimeline_events_liveUpdates from "../domain/vesselTimeline/events/liveUpdates.js";
import type * as domain_vesselTimeline_events_reseed from "../domain/vesselTimeline/events/reseed.js";
import type * as domain_vesselTimeline_events_seed from "../domain/vesselTimeline/events/seed.js";
import type * as domain_vesselTimeline_normalizedEvents from "../domain/vesselTimeline/normalizedEvents.js";
import type * as domain_vesselTimeline_timelineEvents from "../domain/vesselTimeline/timelineEvents.js";
import type * as domain_vesselTimeline_viewModel from "../domain/vesselTimeline/viewModel.js";
import type * as functions_eventsActual_actualRowsEqual from "../functions/eventsActual/actualRowsEqual.js";
import type * as functions_eventsActual_mutations from "../functions/eventsActual/mutations.js";
import type * as functions_eventsActual_projectionSchemas from "../functions/eventsActual/projectionSchemas.js";
import type * as functions_eventsActual_schemas from "../functions/eventsActual/schemas.js";
import type * as functions_eventsPredicted_mutations from "../functions/eventsPredicted/mutations.js";
import type * as functions_eventsPredicted_projectionSchemas from "../functions/eventsPredicted/projectionSchemas.js";
import type * as functions_eventsPredicted_schemas from "../functions/eventsPredicted/schemas.js";
import type * as functions_eventsScheduled_dockedScheduleResolver from "../functions/eventsScheduled/dockedScheduleResolver.js";
import type * as functions_eventsScheduled_index from "../functions/eventsScheduled/index.js";
import type * as functions_eventsScheduled_queries from "../functions/eventsScheduled/queries.js";
import type * as functions_eventsScheduled_schemas from "../functions/eventsScheduled/schemas.js";
import type * as functions_eventsScheduled_segmentResolvers from "../functions/eventsScheduled/segmentResolvers.js";
import type * as functions_index from "../functions/index.js";
import type * as functions_keyValueStore_actions from "../functions/keyValueStore/actions.js";
import type * as functions_keyValueStore_helpers from "../functions/keyValueStore/helpers.js";
import type * as functions_keyValueStore_index from "../functions/keyValueStore/index.js";
import type * as functions_keyValueStore_migrations from "../functions/keyValueStore/migrations.js";
import type * as functions_keyValueStore_mutations from "../functions/keyValueStore/mutations.js";
import type * as functions_keyValueStore_queries from "../functions/keyValueStore/queries.js";
import type * as functions_keyValueStore_schemas from "../functions/keyValueStore/schemas.js";
import type * as functions_predictions_index from "../functions/predictions/index.js";
import type * as functions_predictions_mutations from "../functions/predictions/mutations.js";
import type * as functions_predictions_queries from "../functions/predictions/queries.js";
import type * as functions_predictions_schemas from "../functions/predictions/schemas.js";
import type * as functions_predictions_utils from "../functions/predictions/utils.js";
import type * as functions_scheduledTrips_actions from "../functions/scheduledTrips/actions.js";
import type * as functions_scheduledTrips_index from "../functions/scheduledTrips/index.js";
import type * as functions_scheduledTrips_mutations from "../functions/scheduledTrips/mutations.js";
import type * as functions_scheduledTrips_queries from "../functions/scheduledTrips/queries.js";
import type * as functions_scheduledTrips_schemas from "../functions/scheduledTrips/schemas.js";
import type * as functions_scheduledTrips_sync_fetchAndTransform from "../functions/scheduledTrips/sync/fetchAndTransform.js";
import type * as functions_scheduledTrips_sync_fetching_download from "../functions/scheduledTrips/sync/fetching/download.js";
import type * as functions_scheduledTrips_sync_fetching_index from "../functions/scheduledTrips/sync/fetching/index.js";
import type * as functions_scheduledTrips_sync_fetching_mapping from "../functions/scheduledTrips/sync/fetching/mapping.js";
import type * as functions_scheduledTrips_sync_fetching_wsfApi from "../functions/scheduledTrips/sync/fetching/wsfApi.js";
import type * as functions_scheduledTrips_sync_index from "../functions/scheduledTrips/sync/index.js";
import type * as functions_scheduledTrips_sync_persistence from "../functions/scheduledTrips/sync/persistence.js";
import type * as functions_scheduledTrips_sync_sync from "../functions/scheduledTrips/sync/sync.js";
import type * as functions_scheduledTrips_sync_transform_directSegments from "../functions/scheduledTrips/sync/transform/directSegments.js";
import type * as functions_scheduledTrips_sync_transform_estimates from "../functions/scheduledTrips/sync/transform/estimates.js";
import type * as functions_scheduledTrips_sync_transform_grouping from "../functions/scheduledTrips/sync/transform/grouping.js";
import type * as functions_scheduledTrips_sync_transform_index from "../functions/scheduledTrips/sync/transform/index.js";
import type * as functions_scheduledTrips_sync_transform_officialCrossingTimes from "../functions/scheduledTrips/sync/transform/officialCrossingTimes.js";
import type * as functions_scheduledTrips_sync_transform_pipeline from "../functions/scheduledTrips/sync/transform/pipeline.js";
import type * as functions_scheduledTrips_sync_types from "../functions/scheduledTrips/sync/types.js";
import type * as functions_terminals_actions from "../functions/terminals/actions.js";
import type * as functions_terminals_mutations from "../functions/terminals/mutations.js";
import type * as functions_terminals_queries from "../functions/terminals/queries.js";
import type * as functions_terminals_resolver from "../functions/terminals/resolver.js";
import type * as functions_terminals_schemas from "../functions/terminals/schemas.js";
import type * as functions_terminalsTopology_actions from "../functions/terminalsTopology/actions.js";
import type * as functions_terminalsTopology_mutations from "../functions/terminalsTopology/mutations.js";
import type * as functions_terminalsTopology_queries from "../functions/terminalsTopology/queries.js";
import type * as functions_terminalsTopology_schemas from "../functions/terminalsTopology/schemas.js";
import type * as functions_vesselLocation_index from "../functions/vesselLocation/index.js";
import type * as functions_vesselLocation_mutations from "../functions/vesselLocation/mutations.js";
import type * as functions_vesselLocation_queries from "../functions/vesselLocation/queries.js";
import type * as functions_vesselLocation_schemas from "../functions/vesselLocation/schemas.js";
import type * as functions_vesselLocationsHistoric_actions from "../functions/vesselLocationsHistoric/actions.js";
import type * as functions_vesselLocationsHistoric_index from "../functions/vesselLocationsHistoric/index.js";
import type * as functions_vesselLocationsHistoric_mutations from "../functions/vesselLocationsHistoric/mutations.js";
import type * as functions_vesselLocationsHistoric_queries from "../functions/vesselLocationsHistoric/queries.js";
import type * as functions_vesselLocationsHistoric_schemas from "../functions/vesselLocationsHistoric/schemas.js";
import type * as functions_vesselOrchestrator_actions from "../functions/vesselOrchestrator/actions.js";
import type * as functions_vesselOrchestrator_index from "../functions/vesselOrchestrator/index.js";
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
import type * as functions_vesselTimeline_actions from "../functions/vesselTimeline/actions.js";
import type * as functions_vesselTimeline_backbone_getVesselTimelineBackbone from "../functions/vesselTimeline/backbone/getVesselTimelineBackbone.js";
import type * as functions_vesselTimeline_backbone_loadBackboneInputs from "../functions/vesselTimeline/backbone/loadBackboneInputs.js";
import type * as functions_vesselTimeline_index from "../functions/vesselTimeline/index.js";
import type * as functions_vesselTimeline_mutations from "../functions/vesselTimeline/mutations.js";
import type * as functions_vesselTimeline_queries from "../functions/vesselTimeline/queries.js";
import type * as functions_vesselTimeline_schemas from "../functions/vesselTimeline/schemas.js";
import type * as functions_vesselTrips_index from "../functions/vesselTrips/index.js";
import type * as functions_vesselTrips_mutations from "../functions/vesselTrips/mutations.js";
import type * as functions_vesselTrips_queries from "../functions/vesselTrips/queries.js";
import type * as functions_vesselTrips_schemas from "../functions/vesselTrips/schemas.js";
import type * as functions_vesselTrips_updates_appendPredictions from "../functions/vesselTrips/updates/appendPredictions.js";
import type * as functions_vesselTrips_updates_appendSchedule from "../functions/vesselTrips/updates/appendSchedule.js";
import type * as functions_vesselTrips_updates_baseTripFromLocation from "../functions/vesselTrips/updates/baseTripFromLocation.js";
import type * as functions_vesselTrips_updates_buildCompletedTrip from "../functions/vesselTrips/updates/buildCompletedTrip.js";
import type * as functions_vesselTrips_updates_buildTrip from "../functions/vesselTrips/updates/buildTrip.js";
import type * as functions_vesselTrips_updates_effectiveLocation from "../functions/vesselTrips/updates/effectiveLocation.js";
import type * as functions_vesselTrips_updates_eventDetection from "../functions/vesselTrips/updates/eventDetection.js";
import type * as functions_vesselTrips_updates_index from "../functions/vesselTrips/updates/index.js";
import type * as functions_vesselTrips_updates_processVesselTrips_index from "../functions/vesselTrips/updates/processVesselTrips/index.js";
import type * as functions_vesselTrips_updates_processVesselTrips_processCompletedTrips from "../functions/vesselTrips/updates/processVesselTrips/processCompletedTrips.js";
import type * as functions_vesselTrips_updates_processVesselTrips_processCurrentTrips from "../functions/vesselTrips/updates/processVesselTrips/processCurrentTrips.js";
import type * as functions_vesselTrips_updates_processVesselTrips_processVesselTrips from "../functions/vesselTrips/updates/processVesselTrips/processVesselTrips.js";
import type * as functions_vesselTrips_updates_tripDerivation from "../functions/vesselTrips/updates/tripDerivation.js";
import type * as functions_vesselTrips_updates_tripEquality from "../functions/vesselTrips/updates/tripEquality.js";
import type * as functions_vessels_actions from "../functions/vessels/actions.js";
import type * as functions_vessels_schemas from "../functions/vessels/schemas.js";
import type * as shared_activeTimelineInterval from "../shared/activeTimelineInterval.js";
import type * as shared_convertDates from "../shared/convertDates.js";
import type * as shared_distanceUtils from "../shared/distanceUtils.js";
import type * as shared_durationUtils from "../shared/durationUtils.js";
import type * as shared_effectiveTripIdentity from "../shared/effectiveTripIdentity.js";
import type * as shared_fetchWsfScheduleData from "../shared/fetchWsfScheduleData.js";
import type * as shared_fetchWsfVesselLocations from "../shared/fetchWsfVesselLocations.js";
import type * as shared_identity from "../shared/identity.js";
import type * as shared_index from "../shared/index.js";
import type * as shared_keys from "../shared/keys.js";
import type * as shared_scheduleIdentity from "../shared/scheduleIdentity.js";
import type * as shared_stripConvexMeta from "../shared/stripConvexMeta.js";
import type * as shared_time from "../shared/time.js";
import type * as shared_timelineIntervals from "../shared/timelineIntervals.js";
import type * as shared_tripIdentity from "../shared/tripIdentity.js";
import type * as shared_vessels from "../shared/vessels.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "domain/index": typeof domain_index;
  "domain/ml/index": typeof domain_ml_index;
  "domain/ml/prediction/applyModel": typeof domain_ml_prediction_applyModel;
  "domain/ml/prediction/index": typeof domain_ml_prediction_index;
  "domain/ml/prediction/metrics": typeof domain_ml_prediction_metrics;
  "domain/ml/prediction/predictTrip": typeof domain_ml_prediction_predictTrip;
  "domain/ml/prediction/predictionService": typeof domain_ml_prediction_predictionService;
  "domain/ml/prediction/vesselTripPredictions": typeof domain_ml_prediction_vesselTripPredictions;
  "domain/ml/shared/config": typeof domain_ml_shared_config;
  "domain/ml/shared/featureRecord": typeof domain_ml_shared_featureRecord;
  "domain/ml/shared/features": typeof domain_ml_shared_features;
  "domain/ml/shared/index": typeof domain_ml_shared_index;
  "domain/ml/shared/models": typeof domain_ml_shared_models;
  "domain/ml/shared/types": typeof domain_ml_shared_types;
  "domain/ml/shared/unifiedTrip": typeof domain_ml_shared_unifiedTrip;
  "domain/ml/training/actions": typeof domain_ml_training_actions;
  "domain/ml/training/data/createTrainingBuckets": typeof domain_ml_training_data_createTrainingBuckets;
  "domain/ml/training/data/createTrainingWindows": typeof domain_ml_training_data_createTrainingWindows;
  "domain/ml/training/data/index": typeof domain_ml_training_data_index;
  "domain/ml/training/data/loadTrainingData": typeof domain_ml_training_data_loadTrainingData;
  "domain/ml/training/index": typeof domain_ml_training_index;
  "domain/ml/training/models/index": typeof domain_ml_training_models_index;
  "domain/ml/training/models/storeModels": typeof domain_ml_training_models_storeModels;
  "domain/ml/training/models/trainModels": typeof domain_ml_training_models_trainModels;
  "domain/ml/training/pipeline": typeof domain_ml_training_pipeline;
  "domain/vesselTimeline/events/history": typeof domain_vesselTimeline_events_history;
  "domain/vesselTimeline/events/index": typeof domain_vesselTimeline_events_index;
  "domain/vesselTimeline/events/liveUpdates": typeof domain_vesselTimeline_events_liveUpdates;
  "domain/vesselTimeline/events/reseed": typeof domain_vesselTimeline_events_reseed;
  "domain/vesselTimeline/events/seed": typeof domain_vesselTimeline_events_seed;
  "domain/vesselTimeline/normalizedEvents": typeof domain_vesselTimeline_normalizedEvents;
  "domain/vesselTimeline/timelineEvents": typeof domain_vesselTimeline_timelineEvents;
  "domain/vesselTimeline/viewModel": typeof domain_vesselTimeline_viewModel;
  "functions/eventsActual/actualRowsEqual": typeof functions_eventsActual_actualRowsEqual;
  "functions/eventsActual/mutations": typeof functions_eventsActual_mutations;
  "functions/eventsActual/projectionSchemas": typeof functions_eventsActual_projectionSchemas;
  "functions/eventsActual/schemas": typeof functions_eventsActual_schemas;
  "functions/eventsPredicted/mutations": typeof functions_eventsPredicted_mutations;
  "functions/eventsPredicted/projectionSchemas": typeof functions_eventsPredicted_projectionSchemas;
  "functions/eventsPredicted/schemas": typeof functions_eventsPredicted_schemas;
  "functions/eventsScheduled/dockedScheduleResolver": typeof functions_eventsScheduled_dockedScheduleResolver;
  "functions/eventsScheduled/index": typeof functions_eventsScheduled_index;
  "functions/eventsScheduled/queries": typeof functions_eventsScheduled_queries;
  "functions/eventsScheduled/schemas": typeof functions_eventsScheduled_schemas;
  "functions/eventsScheduled/segmentResolvers": typeof functions_eventsScheduled_segmentResolvers;
  "functions/index": typeof functions_index;
  "functions/keyValueStore/actions": typeof functions_keyValueStore_actions;
  "functions/keyValueStore/helpers": typeof functions_keyValueStore_helpers;
  "functions/keyValueStore/index": typeof functions_keyValueStore_index;
  "functions/keyValueStore/migrations": typeof functions_keyValueStore_migrations;
  "functions/keyValueStore/mutations": typeof functions_keyValueStore_mutations;
  "functions/keyValueStore/queries": typeof functions_keyValueStore_queries;
  "functions/keyValueStore/schemas": typeof functions_keyValueStore_schemas;
  "functions/predictions/index": typeof functions_predictions_index;
  "functions/predictions/mutations": typeof functions_predictions_mutations;
  "functions/predictions/queries": typeof functions_predictions_queries;
  "functions/predictions/schemas": typeof functions_predictions_schemas;
  "functions/predictions/utils": typeof functions_predictions_utils;
  "functions/scheduledTrips/actions": typeof functions_scheduledTrips_actions;
  "functions/scheduledTrips/index": typeof functions_scheduledTrips_index;
  "functions/scheduledTrips/mutations": typeof functions_scheduledTrips_mutations;
  "functions/scheduledTrips/queries": typeof functions_scheduledTrips_queries;
  "functions/scheduledTrips/schemas": typeof functions_scheduledTrips_schemas;
  "functions/scheduledTrips/sync/fetchAndTransform": typeof functions_scheduledTrips_sync_fetchAndTransform;
  "functions/scheduledTrips/sync/fetching/download": typeof functions_scheduledTrips_sync_fetching_download;
  "functions/scheduledTrips/sync/fetching/index": typeof functions_scheduledTrips_sync_fetching_index;
  "functions/scheduledTrips/sync/fetching/mapping": typeof functions_scheduledTrips_sync_fetching_mapping;
  "functions/scheduledTrips/sync/fetching/wsfApi": typeof functions_scheduledTrips_sync_fetching_wsfApi;
  "functions/scheduledTrips/sync/index": typeof functions_scheduledTrips_sync_index;
  "functions/scheduledTrips/sync/persistence": typeof functions_scheduledTrips_sync_persistence;
  "functions/scheduledTrips/sync/sync": typeof functions_scheduledTrips_sync_sync;
  "functions/scheduledTrips/sync/transform/directSegments": typeof functions_scheduledTrips_sync_transform_directSegments;
  "functions/scheduledTrips/sync/transform/estimates": typeof functions_scheduledTrips_sync_transform_estimates;
  "functions/scheduledTrips/sync/transform/grouping": typeof functions_scheduledTrips_sync_transform_grouping;
  "functions/scheduledTrips/sync/transform/index": typeof functions_scheduledTrips_sync_transform_index;
  "functions/scheduledTrips/sync/transform/officialCrossingTimes": typeof functions_scheduledTrips_sync_transform_officialCrossingTimes;
  "functions/scheduledTrips/sync/transform/pipeline": typeof functions_scheduledTrips_sync_transform_pipeline;
  "functions/scheduledTrips/sync/types": typeof functions_scheduledTrips_sync_types;
  "functions/terminals/actions": typeof functions_terminals_actions;
  "functions/terminals/mutations": typeof functions_terminals_mutations;
  "functions/terminals/queries": typeof functions_terminals_queries;
  "functions/terminals/resolver": typeof functions_terminals_resolver;
  "functions/terminals/schemas": typeof functions_terminals_schemas;
  "functions/terminalsTopology/actions": typeof functions_terminalsTopology_actions;
  "functions/terminalsTopology/mutations": typeof functions_terminalsTopology_mutations;
  "functions/terminalsTopology/queries": typeof functions_terminalsTopology_queries;
  "functions/terminalsTopology/schemas": typeof functions_terminalsTopology_schemas;
  "functions/vesselLocation/index": typeof functions_vesselLocation_index;
  "functions/vesselLocation/mutations": typeof functions_vesselLocation_mutations;
  "functions/vesselLocation/queries": typeof functions_vesselLocation_queries;
  "functions/vesselLocation/schemas": typeof functions_vesselLocation_schemas;
  "functions/vesselLocationsHistoric/actions": typeof functions_vesselLocationsHistoric_actions;
  "functions/vesselLocationsHistoric/index": typeof functions_vesselLocationsHistoric_index;
  "functions/vesselLocationsHistoric/mutations": typeof functions_vesselLocationsHistoric_mutations;
  "functions/vesselLocationsHistoric/queries": typeof functions_vesselLocationsHistoric_queries;
  "functions/vesselLocationsHistoric/schemas": typeof functions_vesselLocationsHistoric_schemas;
  "functions/vesselOrchestrator/actions": typeof functions_vesselOrchestrator_actions;
  "functions/vesselOrchestrator/index": typeof functions_vesselOrchestrator_index;
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
  "functions/vesselTimeline/actions": typeof functions_vesselTimeline_actions;
  "functions/vesselTimeline/backbone/getVesselTimelineBackbone": typeof functions_vesselTimeline_backbone_getVesselTimelineBackbone;
  "functions/vesselTimeline/backbone/loadBackboneInputs": typeof functions_vesselTimeline_backbone_loadBackboneInputs;
  "functions/vesselTimeline/index": typeof functions_vesselTimeline_index;
  "functions/vesselTimeline/mutations": typeof functions_vesselTimeline_mutations;
  "functions/vesselTimeline/queries": typeof functions_vesselTimeline_queries;
  "functions/vesselTimeline/schemas": typeof functions_vesselTimeline_schemas;
  "functions/vesselTrips/index": typeof functions_vesselTrips_index;
  "functions/vesselTrips/mutations": typeof functions_vesselTrips_mutations;
  "functions/vesselTrips/queries": typeof functions_vesselTrips_queries;
  "functions/vesselTrips/schemas": typeof functions_vesselTrips_schemas;
  "functions/vesselTrips/updates/appendPredictions": typeof functions_vesselTrips_updates_appendPredictions;
  "functions/vesselTrips/updates/appendSchedule": typeof functions_vesselTrips_updates_appendSchedule;
  "functions/vesselTrips/updates/baseTripFromLocation": typeof functions_vesselTrips_updates_baseTripFromLocation;
  "functions/vesselTrips/updates/buildCompletedTrip": typeof functions_vesselTrips_updates_buildCompletedTrip;
  "functions/vesselTrips/updates/buildTrip": typeof functions_vesselTrips_updates_buildTrip;
  "functions/vesselTrips/updates/effectiveLocation": typeof functions_vesselTrips_updates_effectiveLocation;
  "functions/vesselTrips/updates/eventDetection": typeof functions_vesselTrips_updates_eventDetection;
  "functions/vesselTrips/updates/index": typeof functions_vesselTrips_updates_index;
  "functions/vesselTrips/updates/processVesselTrips/index": typeof functions_vesselTrips_updates_processVesselTrips_index;
  "functions/vesselTrips/updates/processVesselTrips/processCompletedTrips": typeof functions_vesselTrips_updates_processVesselTrips_processCompletedTrips;
  "functions/vesselTrips/updates/processVesselTrips/processCurrentTrips": typeof functions_vesselTrips_updates_processVesselTrips_processCurrentTrips;
  "functions/vesselTrips/updates/processVesselTrips/processVesselTrips": typeof functions_vesselTrips_updates_processVesselTrips_processVesselTrips;
  "functions/vesselTrips/updates/tripDerivation": typeof functions_vesselTrips_updates_tripDerivation;
  "functions/vesselTrips/updates/tripEquality": typeof functions_vesselTrips_updates_tripEquality;
  "functions/vessels/actions": typeof functions_vessels_actions;
  "functions/vessels/schemas": typeof functions_vessels_schemas;
  "shared/activeTimelineInterval": typeof shared_activeTimelineInterval;
  "shared/convertDates": typeof shared_convertDates;
  "shared/distanceUtils": typeof shared_distanceUtils;
  "shared/durationUtils": typeof shared_durationUtils;
  "shared/effectiveTripIdentity": typeof shared_effectiveTripIdentity;
  "shared/fetchWsfScheduleData": typeof shared_fetchWsfScheduleData;
  "shared/fetchWsfVesselLocations": typeof shared_fetchWsfVesselLocations;
  "shared/identity": typeof shared_identity;
  "shared/index": typeof shared_index;
  "shared/keys": typeof shared_keys;
  "shared/scheduleIdentity": typeof shared_scheduleIdentity;
  "shared/stripConvexMeta": typeof shared_stripConvexMeta;
  "shared/time": typeof shared_time;
  "shared/timelineIntervals": typeof shared_timelineIntervals;
  "shared/tripIdentity": typeof shared_tripIdentity;
  "shared/vessels": typeof shared_vessels;
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
