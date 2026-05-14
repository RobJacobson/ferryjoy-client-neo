/**
 * Tiny collection helpers shared across the reload pipeline.
 *
 * These functions filter out optional projection slots and group rows by string
 * key without leaking imperative loops into the pipeline stages, so each stage
 * stays a short composition of array transforms.
 */

/**
 * Filters out undefined slots after optional projections.
 *
 * Reload stages frequently project rows that may be skipped (missing TripKey,
 * empty boundary, suppressed by a guard). This helper concentrates that filter
 * so callers can keep their pipelines flat without explicit type guards.
 *
 * @param rows - Row candidates where some pipeline stages omit entries
 * @returns Defined rows only, stable input order preserved
 */
const definedRows = <TRow>(rows: Array<TRow | undefined>): TRow[] =>
  rows.filter((row): row is TRow => row !== undefined);

/**
 * Expands each source item to zero or more rows and concatenates the results.
 *
 * Used wherever a single trip or segment fans out into several boundary or
 * actual rows. Centralizing the flatMap keeps stage callers focused on the
 * per-item mapper they care about.
 *
 * @param items - Source collection walked in input order
 * @param toRows - Mapper producing row arrays per item
 * @returns Flattened rows from every item
 */
const collectRows = <TItem, TRow>(
  items: TItem[],
  toRows: (item: TItem) => TRow[]
): TRow[] => items.flatMap(toRows);

/**
 * Immutable helper that appends one value to a string-keyed list map bucket.
 *
 * Returns a fresh Map so stage code can stay reduce-friendly without mutating
 * accumulators. Existing buckets are copied so the prior Map reference remains
 * stable for callers that retained it.
 *
 * @param map - Prior grouped values keyed by string
 * @param key - Bucket key whose array receives value
 * @param value - Element appended after existing bucket contents
 * @returns New map instance with the bucket copied and extended
 */
const addMapListValue = <TValue>(
  map: Map<string, TValue[]>,
  key: string,
  value: TValue
): Map<string, TValue[]> =>
  new Map(map).set(key, [...(map.get(key) ?? []), value]);

export { addMapListValue, collectRows, definedRows };
