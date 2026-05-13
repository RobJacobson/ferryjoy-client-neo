/**
 * Converts WSF reload epoch-ms rows into adapter Date shapes for resolution
 * helpers.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { WsfScheduledSegment, WsfVesselHistory } from "./types";

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

/**
 * Maps one epoch-ms WSF history row to the adapter VesselHistory Date shape.
 *
 * @param row - History row with optional epoch-ms timestamps
 * @returns VesselHistory with Date fields for resolveVesselHistory
 */
const toAdapterHistoryRecord = (row: WsfVesselHistory): VesselHistory =>
  ({
    ...row,
    ScheduledDepart:
      row.ScheduledDepart !== undefined
        ? new Date(row.ScheduledDepart)
        : undefined,
    ActualDepart:
      row.ActualDepart !== undefined ? new Date(row.ActualDepart) : undefined,
    EstArrival:
      row.EstArrival !== undefined ? new Date(row.EstArrival) : undefined,
  }) as VesselHistory;

export { toAdapterHistoryRecord, toAdapterScheduleSegment };
