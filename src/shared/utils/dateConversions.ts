/**
 * Date conversion utilities
 *
 * These functions handle conversion between epoch milliseconds (number) and Date objects
 * for the domain layer (Date objects) and storage layers (numbers).
 */

/**
 * Convert epoch milliseconds to Date object
 *
 * @param ms - Epoch milliseconds
 * @returns Date object
 */
export const epochMsToDate = (ms: number): Date => new Date(ms);

/**
 * Convert Date object to epoch milliseconds
 *
 * @param date - Date object
 * @returns Epoch milliseconds
 */
export const dateToEpochMs = (date: Date): number => date.getTime();

/**
 * Convert optional epoch milliseconds to optional Date
 *
 * @param ms - Optional epoch milliseconds
 * @returns Optional Date object
 */
export const optionalEpochMsToDate = (
  ms: number | undefined | null
): Date | undefined => (ms ? new Date(ms) : undefined);

/**
 * Convert optional Date to optional epoch milliseconds
 *
 * @param date - Optional Date object
 * @returns Optional epoch milliseconds
 */
export const optionalDateToEpochMs = (
  date: Date | undefined | null
): number | undefined => (date ? date.getTime() : undefined);
