/**
 * Polyfill for Object.groupBy (ES2024).
 * React Native's Hermes does not support it yet. Import this once at app startup.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy
 */

if (typeof (Object as unknown as { groupBy?: unknown }).groupBy === "undefined") {
  const groupBy = <T, K extends string | number | symbol>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K
  ): Partial<Record<K, T[]>> => {
    const result = Object.create(null) as Record<K, T[]>;
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index);
      const list = result[key];
      if (list) list.push(item);
      else result[key] = [item];
      index += 1;
    }
    return result;
  };
  (Object as unknown as { groupBy: typeof groupBy }).groupBy = groupBy;
}
