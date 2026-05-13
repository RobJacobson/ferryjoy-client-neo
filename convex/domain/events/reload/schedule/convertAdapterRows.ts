/**
 * Converts WSF reload epoch-ms rows into adapter Date shapes for resolution
 * helpers.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { WsfScheduledSegment } from "../schemas/validateReloadInput";

/**
 * Maps one epoch-ms scheduled segment to an adapter segment with Date fields.
 *
 * Reload inputs cross the action-to-mutation boundary in Convex value space,
 * which means trip times arrive as epoch milliseconds. Adapter resolvers
 * expect Date objects, so this helper wraps the numeric timestamps into Date
 * instances without changing any other fields, keeping the adapter contract
 * unchanged while the reload pipeline remains epoch-ms internally.
 *
 * @param segment - WSF scheduled segment using epoch-ms for trip times
 * @returns Adapter-shaped segment for resolveScheduleSegment
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
