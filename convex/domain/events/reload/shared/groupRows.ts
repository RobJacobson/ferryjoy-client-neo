/**
 * Small collection helpers used across sailing-day reload row assembly.
 */

/**
 * Groups values by a stable key into a Map of arrays.
 *
 * @param values - Values to partition
 * @param getKey - Key function
 * @returns Map from key to all values with that key
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
