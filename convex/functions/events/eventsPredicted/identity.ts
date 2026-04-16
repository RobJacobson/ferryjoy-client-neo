/**
 * Persistence identity helpers for `eventsPredicted`.
 */

/**
 * Map key / dedupe id for one `eventsPredicted` row: `Key`, prediction type,
 * and source.
 *
 * @param row - Row identity fields only
 * @returns Single string for `Map` lookups
 */
export const predictedDockCompositeKey = (row: {
  Key: string;
  PredictionType: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionType}|${row.PredictionSource}`;
