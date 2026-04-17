/**
 * Dedupe helpers for vessel trip documents loaded from overlapping indexed queries.
 *
 * Multiple writes for the same physical trip can exist; callers collapse by TripKey
 * before hydrating predictions.
 */

/**
 * Dedupe stored trip documents by physical TripKey (last write wins).
 *
 * @param docs - Trip rows that may contain duplicate TripKey values
 * @returns Deduplicated rows in arbitrary stable order
 */
export const dedupeTripDocsByTripKey = <T extends { TripKey: string }>(
  docs: readonly T[]
): T[] => {
  const byTripKey = new Map<string, T>();
  for (const doc of docs) {
    byTripKey.set(doc.TripKey, doc);
  }
  return Array.from(byTripKey.values());
};

/**
 * Dedupe across multiple query batches that may overlap on TripKey.
 *
 * @param batches - One batch per route, terminal, etc.
 * @returns Deduplicated rows
 */
export const dedupeTripDocBatchesByTripKey = <T extends { TripKey: string }>(
  batches: readonly (readonly T[])[]
): T[] => {
  const byTripKey = new Map<string, T>();
  for (const batch of batches) {
    for (const doc of batch) {
      byTripKey.set(doc.TripKey, doc);
    }
  }
  return Array.from(byTripKey.values());
};
