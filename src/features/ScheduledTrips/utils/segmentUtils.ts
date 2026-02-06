/**
 * Segment utilities for ScheduledTrips.
 */

/**
 * Extracts unique departing terminal abbrevs from segments for completed-trip lookups.
 *
 * @param segments - Segments with DepartingTerminalAbbrev
 * @returns Unique array of departing terminal abbrevs
 */
export const getDepartingTerminalAbbrevs = (
  segments: { DepartingTerminalAbbrev: string }[]
): string[] => [...new Set(segments.map((s) => s.DepartingTerminalAbbrev))];
