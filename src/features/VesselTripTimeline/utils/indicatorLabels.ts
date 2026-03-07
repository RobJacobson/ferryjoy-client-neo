/**
 * Pure functions for extracting indicator labels from timeline data.
 */

/**
 * Produces a short minutes-until label for indicator content.
 * Uses actual/predicted times only; returns "--" for missing data.
 *
 * @param targetTime - Target timestamp (undefined means no data available)
 * @param now - Current time
 * @returns Remaining minutes label or "--" if no data
 */
export const getMinutesUntilLabel = (
  targetTime: Date | undefined,
  now: Date
): string => {
  if (targetTime === undefined) {
    return "--";
  }
  const remainingMs = targetTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return `${remainingMinutes}m`;
};
