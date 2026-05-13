/**
 * Converts WSF reload epoch-ms rows into adapter Date shapes for resolution
 * helpers.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { WsfScheduledSegment } from "../types";

/**
 * Maps one epoch-ms scheduled segment to an adapter segment with Date fields.
 *
 * @param segment - WSF scheduled segment using epoch-ms for trip times
 * @returns Segment shape expected by resolveScheduleSegment
 */
const toAdapterScheduleSegment = (
  segment: WsfScheduledSegment
): RawWsfScheduleSegment =>
  ({
    ...segment,
    DepartingTime: new Date(segment.DepartingTime),
    ArrivingTime:
      segment.ArrivingTime !== undefined
        ? new Date(segment.ArrivingTime)
        : undefined,
  }) as RawWsfScheduleSegment;

export { toAdapterScheduleSegment };
