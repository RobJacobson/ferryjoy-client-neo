import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";

export type TripFieldDataSource = "wsf" | "inferred";

export type TripFieldInferenceMethod =
  | "next_scheduled_trip"
  | "schedule_rollover";

export type InferredTripFields = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
  SailingDay?: string;
  NextScheduleKey?: string;
  NextScheduledDeparture?: number;
  tripFieldDataSource: TripFieldDataSource;
  // Observability-only metadata for the current resolution path. This stays
  // transient unless we find a concrete operational need to persist it.
  tripFieldInferenceMethod?: TripFieldInferenceMethod;
};

export type ScheduledTripMatch = {
  segment: ConvexInferredScheduledSegment;
  tripFieldInferenceMethod: TripFieldInferenceMethod;
};
