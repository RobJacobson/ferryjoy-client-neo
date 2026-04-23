import type { ResolvedCurrentTripFields, ScheduledTripMatch } from "./types";

/**
 * Converts a schedule segment match into resolved current-trip fields only.
 *
 * @param match - Matched segment plus inference method metadata
 * @returns Narrow current-trip resolution (no next-leg fields)
 */
export const buildResolvedCurrentTripFields = (
  match: ScheduledTripMatch
): ResolvedCurrentTripFields => ({
  ArrivingTerminalAbbrev: match.segment.ArrivingTerminalAbbrev,
  ScheduledDeparture: match.segment.DepartingTime,
  ScheduleKey: match.segment.Key,
  SailingDay: match.segment.SailingDay,
  tripFieldDataSource: "inferred",
  tripFieldInferenceMethod: match.tripFieldInferenceMethod,
});
