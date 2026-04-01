/**
 * Shared record builders for identity catalog lookup indexes.
 */

/**
 * Build an uppercase-keyed record index.
 *
 * @param rows - Rows to index
 * @param getKey - Key selector
 * @returns Uppercase-keyed record
 */
export const indexByUppercase = <TRow>(
  rows: Array<TRow>,
  getKey: (row: TRow) => string
): Record<string, TRow> =>
  rows.reduce<Record<string, TRow>>((acc, row) => {
    acc[getKey(row).toUpperCase()] = row;
    return acc;
  }, {});

/**
 * Build a trimmed string-keyed record index.
 *
 * @param rows - Rows to index
 * @param getKey - Key selector
 * @returns Trimmed-keyed record
 */
export const indexByTrimmed = <TRow>(
  rows: Array<TRow>,
  getKey: (row: TRow) => string
): Record<string, TRow> =>
  rows.reduce<Record<string, TRow>>((acc, row) => {
    acc[getKey(row).trim()] = row;
    return acc;
  }, {});

/**
 * Build a stringified-key record index.
 *
 * @param rows - Rows to index
 * @param getKey - Key selector
 * @returns String-keyed record
 */
export const indexByString = <TRow>(
  rows: Array<TRow>,
  getKey: (row: TRow) => number
): Record<string, TRow> =>
  rows.reduce<Record<string, TRow>>((acc, row) => {
    acc[String(getKey(row))] = row;
    return acc;
  }, {});
