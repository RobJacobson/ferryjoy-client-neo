/**
 * Minimal predicted event domain primitives used outside table persistence.
 *
 * The Stage 2 query rebuild only needs the composite row identity for vessel
 * trip joins. Broader prediction projection behavior belongs to later stages.
 */

/**
 * Builds the map key for one predicted dock row identity.
 *
 * @param row - Row-like value with boundary key, prediction type, and source
 * @returns Composite predicted dock row identity
 */
const predictedDockCompositeKey = (row: {
  Key: string;
  PredictionType: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionType}|${row.PredictionSource}`;

export { predictedDockCompositeKey };
