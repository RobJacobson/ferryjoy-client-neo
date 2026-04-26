/**
 * Prediction-row-only helper for callers that do not need timeline overlays.
 */

import type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
} from "./contracts";
import { updateVesselPredictions } from "./updateVesselPredictions";

export const computeVesselPredictionRows = async (
  input: RunUpdateVesselPredictionsInput
): Promise<RunUpdateVesselPredictionsOutput> => {
  const { predictionRows } = await updateVesselPredictions(input);
  return { predictionRows };
};
