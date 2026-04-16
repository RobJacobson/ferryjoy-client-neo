/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adapters_vesselTrips_processTick from "../adapters/vesselTrips/processTick.js";
import type * as adapters_wsf_fetchVesselLocations from "../adapters/wsf/fetchVesselLocations.js";
import type * as adapters_wsf_index from "../adapters/wsf/index.js";
import type * as adapters_wsf_resolveScheduleSegment from "../adapters/wsf/resolveScheduleSegment.js";
import type * as adapters_wsf_resolveTerminal from "../adapters/wsf/resolveTerminal.js";
import type * as adapters_wsf_resolveVessel from "../adapters/wsf/resolveVessel.js";
import type * as adapters_wsf_resolveVesselHistory from "../adapters/wsf/resolveVesselHistory.js";
import type * as adapters_wsf_scheduledTrips_createScheduledTripFromRawSegment from "../adapters/wsf/scheduledTrips/createScheduledTripFromRawSegment.js";
import type * as adapters_wsf_scheduledTrips_downloadRawWsfScheduleData from "../adapters/wsf/scheduledTrips/downloadRawWsfScheduleData.js";
import type * as adapters_wsf_scheduledTrips_fetchActiveRoutes from "../adapters/wsf/scheduledTrips/fetchActiveRoutes.js";
import type * as adapters_wsf_scheduledTrips_fetchAndTransformScheduledTrips from "../adapters/wsf/scheduledTrips/fetchAndTransformScheduledTrips.js";
import type * as adapters_wsf_scheduledTrips_fetchRouteSchedule from "../adapters/wsf/scheduledTrips/fetchRouteSchedule.js";
import type * as adapters_wsf_scheduledTrips_index from "../adapters/wsf/scheduledTrips/index.js";
import type * as adapters_wsf_scheduledTrips_retryOnce from "../adapters/wsf/scheduledTrips/retryOnce.js";
import type * as adapters_wsf_scheduledTrips_types from "../adapters/wsf/scheduledTrips/types.js";
import type * as crons from "../crons.js";
import type * as domain_index from "../domain/index.js";
import type * as domain_ml_index from "../domain/ml/index.js";
import type * as domain_ml_prediction_applyModel from "../domain/ml/prediction/applyModel.js";
import type * as domain_ml_prediction_index from "../domain/ml/prediction/index.js";
import type * as domain_ml_prediction_metrics from "../domain/ml/prediction/metrics.js";
import type * as domain_ml_prediction_predictTrip from "../domain/ml/prediction/predictTrip.js";
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
import type * as domain_scheduledTrips_applyPrefetchSchedulePolicies from "../domain/scheduledTrips/applyPrefetchSchedulePolicies.js";
import type * as domain_scheduledTrips_buildInitialScheduledTripRow from "../domain/scheduledTrips/buildInitialScheduledTripRow.js";
import type * as domain_scheduledTrips_calculateTripEstimates from "../domain/scheduledTrips/calculateTripEstimates.js";
import type * as domain_scheduledTrips_classifyDirectSegments from "../domain/scheduledTrips/classifyDirectSegments.js";
import type * as domain_scheduledTrips_grouping from "../domain/scheduledTrips/grouping.js";
import type * as domain_scheduledTrips_index from "../domain/scheduledTrips/index.js";
import type * as domain_scheduledTrips_officialCrossingTimes from "../domain/scheduledTrips/officialCrossingTimes.js";
import type * as domain_scheduledTrips_runScheduleTransformPipeline from "../domain/scheduledTrips/runScheduleTransformPipeline.js";
import type * as domain_timelineBackbone_buildTimelineBackbone from "../domain/timelineBackbone/buildTimelineBackbone.js";
import type * as domain_timelineBackbone_index from "../domain/timelineBackbone/index.js";
import type * as domain_timelineReseed_buildReseedTimelineSlice from "../domain/timelineReseed/buildReseedTimelineSlice.js";
import type * as domain_timelineReseed_hydrateWithHistory from "../domain/timelineReseed/hydrateWithHistory.js";
import type * as domain_timelineReseed_index from "../domain/timelineReseed/index.js";
import type * as domain_timelineReseed_mergeActualBoundaryPatchesIntoRows from "../domain/timelineReseed/mergeActualBoundaryPatchesIntoRows.js";
import type * as domain_timelineReseed_normalizeEventRecords from "../domain/timelineReseed/normalizeEventRecords.js";
import type * as domain_timelineReseed_reconcileLiveLocations from "../domain/timelineReseed/reconcileLiveLocations.js";
import type * as domain_timelineReseed_scheduleDepartureLookup from "../domain/timelineReseed/scheduleDepartureLookup.js";
import type * as domain_timelineReseed_seedScheduledEvents from "../domain/timelineReseed/seedScheduledEvents.js";
import type * as domain_timelineRows_bindActualRowsToTrips from "../domain/timelineRows/bindActualRowsToTrips.js";
import type * as domain_timelineRows_buildActualRows from "../domain/timelineRows/buildActualRows.js";
import type * as domain_timelineRows_buildPredictedProjectionEffects from "../domain/timelineRows/buildPredictedProjectionEffects.js";
import type * as domain_timelineRows_buildScheduledRows from "../domain/timelineRows/buildScheduledRows.js";
import type * as domain_timelineRows_index from "../domain/timelineRows/index.js";
import type * as domain_timelineRows_mergeTimelineRows from "../domain/timelineRows/mergeTimelineRows.js";
import type * as domain_timelineRows_scheduledSegmentResolvers from "../domain/timelineRows/scheduledSegmentResolvers.js";
import type * as domain_vesselOrchestration_index from "../domain/vesselOrchestration/index.js";
import type * as domain_vesselOrchestration_passengerTerminalEligibility from "../domain/vesselOrchestration/passengerTerminalEligibility.js";
import type * as domain_vesselOrchestration_runVesselOrchestratorTick from "../domain/vesselOrchestration/runVesselOrchestratorTick.js";
import type * as domain_vesselOrchestration_types from "../domain/vesselOrchestration/types.js";
import type * as domain_vesselTrips_continuity_resolveDockedScheduledSegment from "../domain/vesselTrips/continuity/resolveDockedScheduledSegment.js";
import type * as domain_vesselTrips_continuity_resolveEffectiveDockedLocation from "../domain/vesselTrips/continuity/resolveEffectiveDockedLocation.js";
import type * as domain_vesselTrips_continuity_types from "../domain/vesselTrips/continuity/types.js";
import type * as domain_vesselTrips_index from "../domain/vesselTrips/index.js";
import type * as domain_vesselTrips_mutations_departNextActualization from "../domain/vesselTrips/mutations/departNextActualization.js";
import type * as domain_vesselTrips_processTick_processVesselTrips from "../domain/vesselTrips/processTick/processVesselTrips.js";
import type * as domain_vesselTrips_processTick_tickEnvelope from "../domain/vesselTrips/processTick/tickEnvelope.js";
import type * as domain_vesselTrips_processTick_tickEventWrites from "../domain/vesselTrips/processTick/tickEventWrites.js";
import type * as domain_vesselTrips_processTick_tickPredictionPolicy from "../domain/vesselTrips/processTick/tickPredictionPolicy.js";
import type * as domain_vesselTrips_projection_actualBoundaryPatchesFromTrip from "../domain/vesselTrips/projection/actualBoundaryPatchesFromTrip.js";
import type * as domain_vesselTrips_projection_lifecycleEventTypes from "../domain/vesselTrips/projection/lifecycleEventTypes.js";
import type * as domain_vesselTrips_projection_timelineEventAssembler from "../domain/vesselTrips/projection/timelineEventAssembler.js";
import type * as domain_vesselTrips_read_dedupeTripDocsByTripKey from "../domain/vesselTrips/read/dedupeTripDocsByTripKey.js";
import type * as domain_vesselTrips_read_hydrateStoredTripsWithPredictions from "../domain/vesselTrips/read/hydrateStoredTripsWithPredictions.js";
import type * as domain_vesselTrips_tripLifecycle_appendPredictions from "../domain/vesselTrips/tripLifecycle/appendPredictions.js";
import type * as domain_vesselTrips_tripLifecycle_baseTripFromLocation from "../domain/vesselTrips/tripLifecycle/baseTripFromLocation.js";
import type * as domain_vesselTrips_tripLifecycle_buildCompletedTrip from "../domain/vesselTrips/tripLifecycle/buildCompletedTrip.js";
import type * as domain_vesselTrips_tripLifecycle_buildTrip from "../domain/vesselTrips/tripLifecycle/buildTrip.js";
import type * as domain_vesselTrips_tripLifecycle_detectTripEvents from "../domain/vesselTrips/tripLifecycle/detectTripEvents.js";
import type * as domain_vesselTrips_tripLifecycle_physicalDockSeaDebounce from "../domain/vesselTrips/tripLifecycle/physicalDockSeaDebounce.js";
import type * as domain_vesselTrips_tripLifecycle_processCompletedTrips from "../domain/vesselTrips/tripLifecycle/processCompletedTrips.js";
import type * as domain_vesselTrips_tripLifecycle_processCurrentTrips from "../domain/vesselTrips/tripLifecycle/processCurrentTrips.js";
import type * as domain_vesselTrips_tripLifecycle_stripTripPredictionsForStorage from "../domain/vesselTrips/tripLifecycle/stripTripPredictionsForStorage.js";
import type * as domain_vesselTrips_tripLifecycle_tripDerivation from "../domain/vesselTrips/tripLifecycle/tripDerivation.js";
import type * as domain_vesselTrips_tripLifecycle_tripEquality from "../domain/vesselTrips/tripLifecycle/tripEquality.js";
import type * as domain_vesselTrips_tripLifecycle_tripEventTypes from "../domain/vesselTrips/tripLifecycle/tripEventTypes.js";
import type * as domain_vesselTrips_vesselTripsBuildTripAdapters from "../domain/vesselTrips/vesselTripsBuildTripAdapters.js";
import type * as functions_eventsActual_mutations from "../functions/eventsActual/mutations.js";
import type * as functions_eventsActual_schemas from "../functions/eventsActual/schemas.js";
import type * as functions_eventsPredicted_mutations from "../functions/eventsPredicted/mutations.js";
import type * as functions_eventsPredicted_schemas from "../functions/eventsPredicted/schemas.js";
import type * as functions_eventsScheduled_index from "../functions/eventsScheduled/index.js";
import type * as functions_eventsScheduled_queries from "../functions/eventsScheduled/queries.js";
import type * as functions_eventsScheduled_schemas from "../functions/eventsScheduled/schemas.js";
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
import type * as functions_scheduledTrips_actions from "../functions/scheduledTrips/actions.js";
import type * as functions_scheduledTrips_constants from "../functions/scheduledTrips/constants.js";
import type * as functions_scheduledTrips_index from "../functions/scheduledTrips/index.js";
import type * as functions_scheduledTrips_mutations from "../functions/scheduledTrips/mutations.js";
import type * as functions_scheduledTrips_queries from "../functions/scheduledTrips/queries.js";
import type * as functions_scheduledTrips_schemas from "../functions/scheduledTrips/schemas.js";
import type * as functions_scheduledTrips_sync from "../functions/scheduledTrips/sync.js";
import type * as functions_terminals_actions from "../functions/terminals/actions.js";
import type * as functions_terminals_mutations from "../functions/terminals/mutations.js";
import type * as functions_terminals_queries from "../functions/terminals/queries.js";
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
import type * as functions_vesselOrchestrator_queries from "../functions/vesselOrchestrator/queries.js";
import type * as functions_vesselPing_actions from "../functions/vesselPing/actions.js";
import type * as functions_vesselPing_index from "../functions/vesselPing/index.js";
import type * as functions_vesselPing_mutations from "../functions/vesselPing/mutations.js";
import type * as functions_vesselPing_queries from "../functions/vesselPing/queries.js";
import type * as functions_vesselPings_actions from "../functions/vesselPings/actions.js";
import type * as functions_vesselPings_index from "../functions/vesselPings/index.js";
import type * as functions_vesselPings_mutations from "../functions/vesselPings/mutations.js";
import type * as functions_vesselPings_queries from "../functions/vesselPings/queries.js";
import type * as functions_vesselPings_schemas from "../functions/vesselPings/schemas.js";
import type * as functions_vesselTimeline_actions from "../functions/vesselTimeline/actions.js";
import type * as functions_vesselTimeline_index from "../functions/vesselTimeline/index.js";
import type * as functions_vesselTimeline_mutations from "../functions/vesselTimeline/mutations.js";
import type * as functions_vesselTimeline_queries from "../functions/vesselTimeline/queries.js";
import type * as functions_vesselTimeline_schemas from "../functions/vesselTimeline/schemas.js";
import type * as functions_vesselTrips_mutations from "../functions/vesselTrips/mutations.js";
import type * as functions_vesselTrips_queries from "../functions/vesselTrips/queries.js";
import type * as functions_vesselTrips_schemas from "../functions/vesselTrips/schemas.js";
import type * as functions_vessels_actions from "../functions/vessels/actions.js";
import type * as functions_vessels_schemas from "../functions/vessels/schemas.js";
import type * as shared_activeTimelineInterval from "../shared/activeTimelineInterval.js";
import type * as shared_actualBoundaryRowsEqual from "../shared/actualBoundaryRowsEqual.js";
import type * as shared_convertDates from "../shared/convertDates.js";
import type * as shared_distanceUtils from "../shared/distanceUtils.js";
import type * as shared_durationUtils from "../shared/durationUtils.js";
import type * as shared_effectiveTripIdentity from "../shared/effectiveTripIdentity.js";
import type * as shared_groupBy from "../shared/groupBy.js";
import type * as shared_index from "../shared/index.js";
import type * as shared_keys from "../shared/keys.js";
import type * as shared_physicalTripIdentity from "../shared/physicalTripIdentity.js";
import type * as shared_stripConvexMeta from "../shared/stripConvexMeta.js";
import type * as shared_time from "../shared/time.js";
import type * as shared_timelineIntervals from "../shared/timelineIntervals.js";
import type * as shared_tripIdentity from "../shared/tripIdentity.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "adapters/vesselTrips/processTick": typeof adapters_vesselTrips_processTick;
  "adapters/wsf/fetchVesselLocations": typeof adapters_wsf_fetchVesselLocations;
  "adapters/wsf/index": typeof adapters_wsf_index;
  "adapters/wsf/resolveScheduleSegment": typeof adapters_wsf_resolveScheduleSegment;
  "adapters/wsf/resolveTerminal": typeof adapters_wsf_resolveTerminal;
  "adapters/wsf/resolveVessel": typeof adapters_wsf_resolveVessel;
  "adapters/wsf/resolveVesselHistory": typeof adapters_wsf_resolveVesselHistory;
  "adapters/wsf/scheduledTrips/createScheduledTripFromRawSegment": typeof adapters_wsf_scheduledTrips_createScheduledTripFromRawSegment;
  "adapters/wsf/scheduledTrips/downloadRawWsfScheduleData": typeof adapters_wsf_scheduledTrips_downloadRawWsfScheduleData;
  "adapters/wsf/scheduledTrips/fetchActiveRoutes": typeof adapters_wsf_scheduledTrips_fetchActiveRoutes;
  "adapters/wsf/scheduledTrips/fetchAndTransformScheduledTrips": typeof adapters_wsf_scheduledTrips_fetchAndTransformScheduledTrips;
  "adapters/wsf/scheduledTrips/fetchRouteSchedule": typeof adapters_wsf_scheduledTrips_fetchRouteSchedule;
  "adapters/wsf/scheduledTrips/index": typeof adapters_wsf_scheduledTrips_index;
  "adapters/wsf/scheduledTrips/retryOnce": typeof adapters_wsf_scheduledTrips_retryOnce;
  "adapters/wsf/scheduledTrips/types": typeof adapters_wsf_scheduledTrips_types;
  crons: typeof crons;
  "domain/index": typeof domain_index;
  "domain/ml/index": typeof domain_ml_index;
  "domain/ml/prediction/applyModel": typeof domain_ml_prediction_applyModel;
  "domain/ml/prediction/index": typeof domain_ml_prediction_index;
  "domain/ml/prediction/metrics": typeof domain_ml_prediction_metrics;
  "domain/ml/prediction/predictTrip": typeof domain_ml_prediction_predictTrip;
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
  "domain/scheduledTrips/applyPrefetchSchedulePolicies": typeof domain_scheduledTrips_applyPrefetchSchedulePolicies;
  "domain/scheduledTrips/buildInitialScheduledTripRow": typeof domain_scheduledTrips_buildInitialScheduledTripRow;
  "domain/scheduledTrips/calculateTripEstimates": typeof domain_scheduledTrips_calculateTripEstimates;
  "domain/scheduledTrips/classifyDirectSegments": typeof domain_scheduledTrips_classifyDirectSegments;
  "domain/scheduledTrips/grouping": typeof domain_scheduledTrips_grouping;
  "domain/scheduledTrips/index": typeof domain_scheduledTrips_index;
  "domain/scheduledTrips/officialCrossingTimes": typeof domain_scheduledTrips_officialCrossingTimes;
  "domain/scheduledTrips/runScheduleTransformPipeline": typeof domain_scheduledTrips_runScheduleTransformPipeline;
  "domain/timelineBackbone/buildTimelineBackbone": typeof domain_timelineBackbone_buildTimelineBackbone;
  "domain/timelineBackbone/index": typeof domain_timelineBackbone_index;
  "domain/timelineReseed/buildReseedTimelineSlice": typeof domain_timelineReseed_buildReseedTimelineSlice;
  "domain/timelineReseed/hydrateWithHistory": typeof domain_timelineReseed_hydrateWithHistory;
  "domain/timelineReseed/index": typeof domain_timelineReseed_index;
  "domain/timelineReseed/mergeActualBoundaryPatchesIntoRows": typeof domain_timelineReseed_mergeActualBoundaryPatchesIntoRows;
  "domain/timelineReseed/normalizeEventRecords": typeof domain_timelineReseed_normalizeEventRecords;
  "domain/timelineReseed/reconcileLiveLocations": typeof domain_timelineReseed_reconcileLiveLocations;
  "domain/timelineReseed/scheduleDepartureLookup": typeof domain_timelineReseed_scheduleDepartureLookup;
  "domain/timelineReseed/seedScheduledEvents": typeof domain_timelineReseed_seedScheduledEvents;
  "domain/timelineRows/bindActualRowsToTrips": typeof domain_timelineRows_bindActualRowsToTrips;
  "domain/timelineRows/buildActualRows": typeof domain_timelineRows_buildActualRows;
  "domain/timelineRows/buildPredictedProjectionEffects": typeof domain_timelineRows_buildPredictedProjectionEffects;
  "domain/timelineRows/buildScheduledRows": typeof domain_timelineRows_buildScheduledRows;
  "domain/timelineRows/index": typeof domain_timelineRows_index;
  "domain/timelineRows/mergeTimelineRows": typeof domain_timelineRows_mergeTimelineRows;
  "domain/timelineRows/scheduledSegmentResolvers": typeof domain_timelineRows_scheduledSegmentResolvers;
  "domain/vesselOrchestration/index": typeof domain_vesselOrchestration_index;
  "domain/vesselOrchestration/passengerTerminalEligibility": typeof domain_vesselOrchestration_passengerTerminalEligibility;
  "domain/vesselOrchestration/runVesselOrchestratorTick": typeof domain_vesselOrchestration_runVesselOrchestratorTick;
  "domain/vesselOrchestration/types": typeof domain_vesselOrchestration_types;
  "domain/vesselTrips/continuity/resolveDockedScheduledSegment": typeof domain_vesselTrips_continuity_resolveDockedScheduledSegment;
  "domain/vesselTrips/continuity/resolveEffectiveDockedLocation": typeof domain_vesselTrips_continuity_resolveEffectiveDockedLocation;
  "domain/vesselTrips/continuity/types": typeof domain_vesselTrips_continuity_types;
  "domain/vesselTrips/index": typeof domain_vesselTrips_index;
  "domain/vesselTrips/mutations/departNextActualization": typeof domain_vesselTrips_mutations_departNextActualization;
  "domain/vesselTrips/processTick/processVesselTrips": typeof domain_vesselTrips_processTick_processVesselTrips;
  "domain/vesselTrips/processTick/tickEnvelope": typeof domain_vesselTrips_processTick_tickEnvelope;
  "domain/vesselTrips/processTick/tickEventWrites": typeof domain_vesselTrips_processTick_tickEventWrites;
  "domain/vesselTrips/processTick/tickPredictionPolicy": typeof domain_vesselTrips_processTick_tickPredictionPolicy;
  "domain/vesselTrips/projection/actualBoundaryPatchesFromTrip": typeof domain_vesselTrips_projection_actualBoundaryPatchesFromTrip;
  "domain/vesselTrips/projection/lifecycleEventTypes": typeof domain_vesselTrips_projection_lifecycleEventTypes;
  "domain/vesselTrips/projection/timelineEventAssembler": typeof domain_vesselTrips_projection_timelineEventAssembler;
  "domain/vesselTrips/read/dedupeTripDocsByTripKey": typeof domain_vesselTrips_read_dedupeTripDocsByTripKey;
  "domain/vesselTrips/read/hydrateStoredTripsWithPredictions": typeof domain_vesselTrips_read_hydrateStoredTripsWithPredictions;
  "domain/vesselTrips/tripLifecycle/appendPredictions": typeof domain_vesselTrips_tripLifecycle_appendPredictions;
  "domain/vesselTrips/tripLifecycle/baseTripFromLocation": typeof domain_vesselTrips_tripLifecycle_baseTripFromLocation;
  "domain/vesselTrips/tripLifecycle/buildCompletedTrip": typeof domain_vesselTrips_tripLifecycle_buildCompletedTrip;
  "domain/vesselTrips/tripLifecycle/buildTrip": typeof domain_vesselTrips_tripLifecycle_buildTrip;
  "domain/vesselTrips/tripLifecycle/detectTripEvents": typeof domain_vesselTrips_tripLifecycle_detectTripEvents;
  "domain/vesselTrips/tripLifecycle/physicalDockSeaDebounce": typeof domain_vesselTrips_tripLifecycle_physicalDockSeaDebounce;
  "domain/vesselTrips/tripLifecycle/processCompletedTrips": typeof domain_vesselTrips_tripLifecycle_processCompletedTrips;
  "domain/vesselTrips/tripLifecycle/processCurrentTrips": typeof domain_vesselTrips_tripLifecycle_processCurrentTrips;
  "domain/vesselTrips/tripLifecycle/stripTripPredictionsForStorage": typeof domain_vesselTrips_tripLifecycle_stripTripPredictionsForStorage;
  "domain/vesselTrips/tripLifecycle/tripDerivation": typeof domain_vesselTrips_tripLifecycle_tripDerivation;
  "domain/vesselTrips/tripLifecycle/tripEquality": typeof domain_vesselTrips_tripLifecycle_tripEquality;
  "domain/vesselTrips/tripLifecycle/tripEventTypes": typeof domain_vesselTrips_tripLifecycle_tripEventTypes;
  "domain/vesselTrips/vesselTripsBuildTripAdapters": typeof domain_vesselTrips_vesselTripsBuildTripAdapters;
  "functions/eventsActual/mutations": typeof functions_eventsActual_mutations;
  "functions/eventsActual/schemas": typeof functions_eventsActual_schemas;
  "functions/eventsPredicted/mutations": typeof functions_eventsPredicted_mutations;
  "functions/eventsPredicted/schemas": typeof functions_eventsPredicted_schemas;
  "functions/eventsScheduled/index": typeof functions_eventsScheduled_index;
  "functions/eventsScheduled/queries": typeof functions_eventsScheduled_queries;
  "functions/eventsScheduled/schemas": typeof functions_eventsScheduled_schemas;
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
  "functions/scheduledTrips/actions": typeof functions_scheduledTrips_actions;
  "functions/scheduledTrips/constants": typeof functions_scheduledTrips_constants;
  "functions/scheduledTrips/index": typeof functions_scheduledTrips_index;
  "functions/scheduledTrips/mutations": typeof functions_scheduledTrips_mutations;
  "functions/scheduledTrips/queries": typeof functions_scheduledTrips_queries;
  "functions/scheduledTrips/schemas": typeof functions_scheduledTrips_schemas;
  "functions/scheduledTrips/sync": typeof functions_scheduledTrips_sync;
  "functions/terminals/actions": typeof functions_terminals_actions;
  "functions/terminals/mutations": typeof functions_terminals_mutations;
  "functions/terminals/queries": typeof functions_terminals_queries;
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
  "functions/vesselOrchestrator/queries": typeof functions_vesselOrchestrator_queries;
  "functions/vesselPing/actions": typeof functions_vesselPing_actions;
  "functions/vesselPing/index": typeof functions_vesselPing_index;
  "functions/vesselPing/mutations": typeof functions_vesselPing_mutations;
  "functions/vesselPing/queries": typeof functions_vesselPing_queries;
  "functions/vesselPings/actions": typeof functions_vesselPings_actions;
  "functions/vesselPings/index": typeof functions_vesselPings_index;
  "functions/vesselPings/mutations": typeof functions_vesselPings_mutations;
  "functions/vesselPings/queries": typeof functions_vesselPings_queries;
  "functions/vesselPings/schemas": typeof functions_vesselPings_schemas;
  "functions/vesselTimeline/actions": typeof functions_vesselTimeline_actions;
  "functions/vesselTimeline/index": typeof functions_vesselTimeline_index;
  "functions/vesselTimeline/mutations": typeof functions_vesselTimeline_mutations;
  "functions/vesselTimeline/queries": typeof functions_vesselTimeline_queries;
  "functions/vesselTimeline/schemas": typeof functions_vesselTimeline_schemas;
  "functions/vesselTrips/mutations": typeof functions_vesselTrips_mutations;
  "functions/vesselTrips/queries": typeof functions_vesselTrips_queries;
  "functions/vesselTrips/schemas": typeof functions_vesselTrips_schemas;
  "functions/vessels/actions": typeof functions_vessels_actions;
  "functions/vessels/schemas": typeof functions_vessels_schemas;
  "shared/activeTimelineInterval": typeof shared_activeTimelineInterval;
  "shared/actualBoundaryRowsEqual": typeof shared_actualBoundaryRowsEqual;
  "shared/convertDates": typeof shared_convertDates;
  "shared/distanceUtils": typeof shared_distanceUtils;
  "shared/durationUtils": typeof shared_durationUtils;
  "shared/effectiveTripIdentity": typeof shared_effectiveTripIdentity;
  "shared/groupBy": typeof shared_groupBy;
  "shared/index": typeof shared_index;
  "shared/keys": typeof shared_keys;
  "shared/physicalTripIdentity": typeof shared_physicalTripIdentity;
  "shared/stripConvexMeta": typeof shared_stripConvexMeta;
  "shared/time": typeof shared_time;
  "shared/timelineIntervals": typeof shared_timelineIntervals;
  "shared/tripIdentity": typeof shared_tripIdentity;
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
