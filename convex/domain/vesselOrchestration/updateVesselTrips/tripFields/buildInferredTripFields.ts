import type { ScheduledTripMatch, InferredTripFields } from "./types";

export const buildInferredTripFields = (
  match: ScheduledTripMatch
): InferredTripFields => ({
  ArrivingTerminalAbbrev: match.segment.ArrivingTerminalAbbrev,
  ScheduledDeparture: match.segment.DepartingTime,
  ScheduleKey: match.segment.Key,
  SailingDay: match.segment.SailingDay,
  NextScheduleKey: match.segment.NextKey,
  NextScheduledDeparture: match.segment.NextDepartingTime,
  tripFieldDataSource: "inferred",
  tripFieldInferenceMethod: match.tripFieldInferenceMethod,
});
