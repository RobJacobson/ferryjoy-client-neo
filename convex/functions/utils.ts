/**
 * Converts a date to a time in milliseconds, or undefined if the date is null
 * @param d - The date to convert to a time in milliseconds
 * @returns The time in milliseconds, or undefined if the date is null
 */
export const toTimeMsOrUndefined = (d: Date | null) =>
  d ? d.getTime() : undefined;

/**
 * Converts a time in milliseconds to a date, or null if the time is null
 * @param t - The time to convert to a date
 * @returns The date, or null if the time is null
 */
export const toDateOrNull = (t: number | undefined) => (t ? new Date(t) : null);

/**
 * Converts a value to undefined, or undefined if the value is undefined
 * @param v - The value to convert to undefined
 * @returns The value, or undefined if the value is undefined
 */
export const toValOrUndefined = <T>(v: T | undefined) => v ?? undefined;

/**
 * Converts a value to null, or null if the value is undefined
 * @param v - The value to convert to null
 * @returns The value, or null if the value is undefined
 */
export const toValOrNull = <T>(v: T | undefined) => v ?? null;

export const toDate = (t: number) => new Date(t);

export const toTimeMs = (d: Date) => d.getTime();
