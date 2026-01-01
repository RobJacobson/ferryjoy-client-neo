// ============================================================================
// MODEL STORAGE
// Logic from training/step_6_storeResults.ts
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ModelParameters } from "domain/ml/shared/core/types";

/**
 * Store trained models in the database
 */
export const storeModels = async (
  models: ModelParameters[],
  ctx: ActionCtx
): Promise<void> => {
  console.log(`Storing ${models.length} trained models...`);

  const storePromises = models.map((model) =>
    ctx.runMutation(
      api.functions.predictions.mutations.storeModelParametersMutation,
      { model }
    )
  );

  await Promise.all(storePromises);
  console.log(`Successfully stored ${models.length} models`);
};
