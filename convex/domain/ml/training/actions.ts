"use node";

import { internalAction } from "_generated/server";
import type { TrainingResponse } from "../shared/types";
import { runMLPipeline } from "./pipeline";

export const trainPredictionModelsAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => runMLPipeline(ctx),
});
