// ============================================================================
// STEP 2: LOAD MODEL FROM DATABASE
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ModelParameters } from "../types";

/**
 * Load model parameters from database for a specific terminal pair and model type
 */
export const loadModel = async (
  ctx: ActionCtx | MutationCtx,
  departingTerminal: string,
  arrivingTerminal: string,
  modelType:
    | "arrive-depart-atdock-duration"
    | "arrive-depart-delay"
    | "depart-arrive-atsea-duration"
    | "arrive-arrive-total-duration"
    | "depart-depart-total-duration"
): Promise<ModelParameters | null> => {
  const model = await ctx.runQuery(
    api.functions.predictions.queries.getModelParametersByTerminalPair,
    {
      departingTerminalAbbrev: departingTerminal,
      arrivingTerminalAbbrev: arrivingTerminal,
      modelType,
    }
  );

  if (!model) {
    console.warn(
      `Model not found for ${departingTerminal}->${arrivingTerminal} (${modelType})`
    );
    return null;
  }

  // Validate model has required fields
  if (!model.coefficients || model.intercept === undefined) {
    console.warn(
      `Model has invalid parameters for ${departingTerminal}->${arrivingTerminal} (${modelType})`
    );
    return null;
  }

  // Cast to ModelParameters since we've validated required fields exist
  return model as ModelParameters;
};
