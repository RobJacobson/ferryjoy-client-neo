/**
 * One-ping prediction pass: ML overlay per active trip and completed handoff,
 * then derive table proposals.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type {
  CompletedArrivalHandoff,
  MlTimelineOverlay,
} from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { applyVesselPredictions } from "./applyVesselPredictions";
import type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
} from "./contracts";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

export type UpdateVesselPredictionsOutput = RunUpdateVesselPredictionsOutput & {
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

const predictionModelAccessFromContext = (
  context: VesselPredictionContext
): VesselTripPredictionModelAccess => {
  const loadModelForProductionPair: VesselTripPredictionModelAccess["loadModelForProductionPair"] =
    async (pairKey, modelType) =>
      context.productionModelsByPair?.[pairKey]?.[modelType] ?? null;

  const loadModelsForProductionPairBatch: VesselTripPredictionModelAccess["loadModelsForProductionPairBatch"] =
    async (pairKey, modelTypes) =>
      Object.fromEntries(
        modelTypes.map((modelType) => [
          modelType,
          context.productionModelsByPair?.[pairKey]?.[modelType] ?? null,
        ])
      ) as Awaited<
        ReturnType<
          VesselTripPredictionModelAccess["loadModelsForProductionPairBatch"]
        >
      >;

  return {
    loadModelForProductionPair,
    loadModelsForProductionPairBatch,
  };
};

const buildPredictedCurrentTrip = async (
  trip: ConvexVesselTrip,
  modelAccess: VesselTripPredictionModelAccess
): Promise<MlTimelineOverlay> => {
  const finalPredictedTrip = await applyVesselPredictions(modelAccess, trip);

  return {
    vesselAbbrev: trip.VesselAbbrev,
    branch: "current",
    finalPredictedTrip,
  };
};

const buildPredictedCompletedHandoff = async (
  handoff: CompletedArrivalHandoff,
  modelAccess: VesselTripPredictionModelAccess
): Promise<MlTimelineOverlay> => {
  const finalPredictedTrip = await applyVesselPredictions(
    modelAccess,
    handoff.scheduleTrip
  );

  return {
    vesselAbbrev: handoff.tripToComplete.VesselAbbrev,
    branch: "completed",
    completedHandoffKey: completedHandoffKey(
      handoff.tripToComplete.VesselAbbrev,
      handoff.tripToComplete,
      handoff.scheduleTrip
    ),
    finalPredictedTrip,
  };
};

const completedHandoffKey = (
  vesselAbbrev: string,
  completedTrip: ConvexVesselTrip | undefined,
  activeTrip: ConvexVesselTrip | undefined
): string => {
  const scheduleIdentity =
    completedTrip?.ScheduleKey ??
    completedTrip?.TripKey ??
    activeTrip?.ScheduleKey ??
    activeTrip?.TripKey ??
    "";
  return `${vesselAbbrev}::${scheduleIdentity}`;
};

/**
 * Canonical predictions entrypoint for orchestrator callers.
 *
 * @param input - Current and completed trip facts plus model access context
 * @returns Prediction rows and timeline ML overlays for this ping
 */
export const updateVesselPredictions = async (
  input: RunUpdateVesselPredictionsInput
): Promise<UpdateVesselPredictionsOutput> => {
  const modelAccess = predictionModelAccessFromContext(input.predictionContext);
  const mlTimelineOverlays = [
    ...(await Promise.all(
      input.completedHandoffs.map((handoff) =>
        buildPredictedCompletedHandoff(handoff, modelAccess)
      )
    )),
    ...(await Promise.all(
      input.activeTrips.map((trip) =>
        buildPredictedCurrentTrip(trip, modelAccess)
      )
    )),
  ];

  const predictionRows = mlTimelineOverlays.flatMap((overlay) =>
    overlay.finalPredictedTrip === undefined
      ? []
      : vesselTripPredictionProposalsFromMlTrip(overlay.finalPredictedTrip)
  );

  return {
    predictionRows,
    mlTimelineOverlays,
  };
};
