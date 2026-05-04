/**
 * Stable composite identity for predicted dock rows used when merging batches
 * and indexing reads.
 */

/**
 * Builds a stable dedupe and Map key for one predicted dock row.
 *
 * One boundary Key can host multiple prediction kinds (ML phases and ETA) and
 * sources; concatenating type and source with Key prevents collisions when
 * merging batches or comparing incoming rows to stored documents.
 *
 * @param row - Row or row-like object carrying Key, PredictionType, and PredictionSource
 * @returns Single string used as Map key and composite identity
 */
const predictedDockCompositeKey = (row: {
  Key: string;
  PredictionType: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionType}|${row.PredictionSource}`;

export { predictedDockCompositeKey };
