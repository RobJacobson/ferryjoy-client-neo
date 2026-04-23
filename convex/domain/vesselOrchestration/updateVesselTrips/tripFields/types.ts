import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";

/**
 * Resolved schedule-facing fields for the **current** trip row, before the
 * trip-field resolver attaches next-leg schedule hints.
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
  tripFieldDataSource: "wsf" | "inferred";
  // Observability-only metadata for the current resolution path. This stays
  // transient unless we find a concrete operational need to persist it on trip
  // rows.
  tripFieldInferenceMethod?: "next_scheduled_trip" | "schedule_rollover";
};

export type ScheduledTripMatch = {
  segment: ConvexInferredScheduledSegment;
  tripFieldInferenceMethod: "next_scheduled_trip" | "schedule_rollover";
};
