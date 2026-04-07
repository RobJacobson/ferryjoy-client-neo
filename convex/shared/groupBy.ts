/**
 * Generic bucket helpers for small in-memory indexes (Convex actions, domain
 * merges).
 */

/**
 * Partitions items into buckets by a string key. Order within each bucket
 * follows encounter order in the input.
 *
 * @param items - Values to group
 * @param keyOf - Bucket key for each item
 * @returns Map from key to items in that bucket
 */
export const groupBy = <T>(
  items: ReadonlyArray<T>,
  keyOf: (item: T) => string
): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
};
