/**
 * Generic bucket helpers for small in-memory indexes (Convex actions, domain
 * merges).
 */

/**
 * Partitions items into buckets by a caller-provided key. Order within each
 * bucket follows encounter order in the input.
 *
 * The returned Map preserves the first-seen key order while each bucket keeps
 * the source item order. It is intended for small domain indexes where a Map is
 * clearer than an object and avoids string coercion of caller-owned keys.
 *
 * @param items - Values to group
 * @param keyOf - Bucket key for each item
 * @returns Map from key to items in that bucket
 */
export const groupBy = <TValue, TKey>(
  items: ReadonlyArray<TValue>,
  keyOf: (item: TValue) => TKey
): Map<TKey, TValue[]> =>
  items.reduce(
    (groups, item) =>
      new Map(groups).set(keyOf(item), [
        ...(groups.get(keyOf(item)) ?? []),
        item,
      ]),
    new Map<TKey, TValue[]>()
  );
