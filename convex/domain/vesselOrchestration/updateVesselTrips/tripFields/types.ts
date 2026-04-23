import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";

export type TripFieldDataSource = "wsf" | "inferred";

export type TripFieldInferenceMethod =
  | "next_scheduled_trip"
  | "schedule_rollover";

/**
 * Resolved schedule-facing fields for the **current** trip row, before next-leg
 * enrichment. Next-leg fields are owned exclusively by
 * {@link attachNextScheduledTripFields}.
 */
export type ResolvedCurrentTripFields = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
  SailingDay?: string;
  // Durable semantic source for the resolved trip fields. This describes
  // whether the trip row should be treated as authoritative WSF state or as
  // provisional schedule-backed state; it is not about which helper supplied a
  // fallback value.
  tripFieldDataSource: TripFieldDataSource;
  // Observability-only metadata for the current resolution path. This stays
  // transient unless we find a concrete operational need to persist it on trip
  // rows.
  tripFieldInferenceMethod?: TripFieldInferenceMethod;
};

export type ScheduledTripMatch = {
  segment: ConvexInferredScheduledSegment;
  tripFieldInferenceMethod: TripFieldInferenceMethod;
};
