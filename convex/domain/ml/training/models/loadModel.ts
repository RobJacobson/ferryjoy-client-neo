// ============================================================================
// MODEL LOADING
// Logic from prediction/step_2_loadModel.ts
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ModelParameters, ModelType } from "domain/ml/shared";

/**
 * Load a trained model for prediction
 */
export const loadModel = async (
  ctx: ActionCtx | MutationCtx,
  departingTerminal: string,
  arrivingTerminal: string,
  modelType: ModelType
): Promise<ModelParameters | null> => {
  try {
    const model = await ctx.runQuery(
      api.functions.predictions.queries.getModelParametersByTerminalPair,
      {
        departingTerminalAbbrev: departingTerminal,
        arrivingTerminalAbbrev: arrivingTerminal,
        modelType,
      }
    );

    if (!model) {
      return null;
    }

    // Validate model has required fields
    if (!model.coefficients || model.intercept === undefined) {
      return null;
    }

    return model as ModelParameters;
  } catch (error) {
    console.error(
      `Failed to load model for ${departingTerminal}->${arrivingTerminal} ${modelType}:`,
      error
    );
    return null;
  }
};
