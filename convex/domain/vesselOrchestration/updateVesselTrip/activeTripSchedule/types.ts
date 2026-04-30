/**
 * Resolved schedule-facing fields for the **current** trip row, before the
 * trip-field resolver attaches next-leg schedule hints.
 */
export type ResolvedCurrentTripFields = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
  SailingDay?: string;
  // Observability-only metadata for the current resolution path. This stays
  // transient unless we find a concrete operational need to persist it on trip
  // rows.
  tripFieldResolutionMethod?: TripFieldResolutionMethod;
};

export type TripFieldResolutionMethod =
  | "wsfRealtimeFields"
  | "nextTripKey"
  | "scheduleLookup";

export type ResolvedTripScheduleFields = {
  current: ResolvedCurrentTripFields;
  next?: {
    NextScheduleKey?: string;
    NextScheduledDeparture?: number;
  };
};
