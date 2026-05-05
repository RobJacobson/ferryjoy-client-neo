/**
 * Shared schedule resolution payloads for active-trip enrichment.
 *
 * Schedule resolvers return these transient shapes before merge code writes
 * fields onto a ConvexVesselTrip row. The resolution method is diagnostic data
 * and is not persisted on trip rows.
 */
export type ResolvedCurrentTripFields = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
  SailingDay?: string;
  // Observability-only metadata for the current resolution path that stays transient unless operations require persistence.
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
