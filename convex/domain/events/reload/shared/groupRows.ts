/**
 * Small collection helpers used across sailing-day reload row assembly.
 */

/**
 * Groups values by a stable key into a Map of arrays.
 *
 * Reload row assembly groups boundary records and live locations by vessel,
 * sailing day, or composite keys to bound nested-loop work. Concentrating the
 * groupBy helper here avoids re-implementing the pattern in each builder and
 * keeps insertion order stable so downstream sorts behave the same across
 * input shapes.
 *
 * @param values - Values to partition
 * @param getKey - Function returning the partition key for each value
 * @returns Map from key to all values carrying that key, in insertion order
 */
const groupBy = <TValue, TKey>(
  values: TValue[],
  getKey: (value: TValue) => TKey
): Map<TKey, TValue[]> => {
  const groups = new Map<TKey, TValue[]>();

  for (const value of values) {
    const key = getKey(value);
    const group = groups.get(key);

    if (group) {
      group.push(value);
      continue;
    }

    groups.set(key, [value]);
  }

  return groups;
};

export { groupBy };
