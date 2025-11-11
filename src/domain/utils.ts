/**
 * Converts a timestamp number to a Date object, or returns undefined if the input is undefined/null
 */
export const toDateOrUndefined = (
  timestamp: number | undefined | null
): Date | undefined => {
  if (timestamp === undefined || timestamp === null) {
    return undefined;
  }
  return new Date(timestamp);
};
