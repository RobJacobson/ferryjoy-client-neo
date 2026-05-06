/**
 * Maps inferred schedule segments into vessel-trip schedule resolutions.
 *
 * Schedule lookup paths share the same segment shape but differ in how the
 * segment is selected. This adapter keeps that translation out of the resolver
 * modules so each resolver can focus on its evidence source.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/types";
import type {
  ResolvedCurrentTripFields,
  ResolvedTripScheduleFields,
} from "./types";

/**
 * Converts one inferred scheduled segment into merge-ready trip schedule fields.
 *
 * @param segment - Scheduled segment selected by a schedule resolver
 * @param method - Resolution strategy used to obtain the segment
 * @returns Current and next schedule fields for downstream merge
 */
const mapScheduledSegmentToTripScheduleResolution = (
  segment: ConvexInferredScheduledSegment,
  method: ResolvedCurrentTripFields["tripFieldResolutionMethod"]
): ResolvedTripScheduleFields => ({
  current: {
    ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
    ScheduledDeparture: segment.DepartingTime,
    ScheduleKey: segment.Key,
    SailingDay: segment.SailingDay,
    tripFieldResolutionMethod: method,
  },
  next: {
    NextScheduleKey: segment.NextKey,
    NextScheduledDeparture: segment.NextDepartingTime,
  },
});

export { mapScheduledSegmentToTripScheduleResolution };
