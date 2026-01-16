/**
 * Converts a date to a time in milliseconds, or undefined if the date is null.
 *
 * @param d - The date to convert to a time in milliseconds
 * @returns The time in milliseconds, or undefined if the date is null
 */
export const toTimeMsOrUndefined = (d: Date | null) =>
  d ? d.getTime() : undefined;

/**
 * Converts a time in milliseconds to a date, or null if the time is null.
 *
 * @param t - The time to convert to a date
 * @returns The date, or null if the time is null
 */
export const toDateOrNull = (t: number | undefined) => (t ? new Date(t) : null);

/**
 * Identity function that returns the value or undefined if the value is undefined/null.
 *
 * @param v - The value to return as-is
 * @returns The value, or undefined if the value is undefined/null
 */
export const toValOrUndefined = <T>(v: T | undefined | null): T | undefined =>
  v ?? undefined;

/**
 * Identity function that returns the value or null if the value is undefined/null.
 *
 * @param v - The value to return as-is
 * @returns The value, or null if the value is undefined/null
 */
export const toValOrNull = <T>(v: T | undefined | null): T | null => v ?? null;

/**
 * Convert epoch milliseconds to a Date object.
 *
 * @param t - Epoch milliseconds
 * @returns Date object
 */
export const toDate = (t: number): Date => new Date(t);

/**
 * Convert a Date object to epoch milliseconds.
 *
 * @param d - Date object
 * @returns Epoch milliseconds
 */
export const toTimeMs = (d: Date): number => d.getTime();
