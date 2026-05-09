/**
 * Converts numeric reload wire payloads into adapter Date shapes for WSF
 * resolution helpers.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { ConvexReloadDockHistoryRecord } from "functions/events/eventsActual/schemas";
import type { ConvexReloadDockScheduleSegment } from "functions/events/eventsScheduled/schemas";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

/**
 * Maps one numeric schedule segment row to an adapter segment with Date fields.
 *
 * @param segment - Reload schedule segment using epoch ms for trip times
 * @returns Segment shape expected by resolveScheduleSegment
 */
const toAdapterScheduleSegment = (
  segment: ConvexReloadDockScheduleSegment
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
 * Maps one numeric history row to the adapter VesselHistory Date shape.
 *
 * @param record - Reload history record with optional epoch ms timestamps
 * @returns VesselHistory with Date fields for resolveVesselHistory
 */
const toAdapterHistoryRecord = (
  record: ConvexReloadDockHistoryRecord
): VesselHistory =>
  ({
    ...record,
    ScheduledDepart:
      record.ScheduledDepart !== undefined
        ? new Date(record.ScheduledDepart)
        : undefined,
    ActualDepart:
      record.ActualDepart !== undefined
        ? new Date(record.ActualDepart)
        : undefined,
    EstArrival:
      record.EstArrival !== undefined ? new Date(record.EstArrival) : undefined,
  }) as VesselHistory;

export { toAdapterHistoryRecord, toAdapterScheduleSegment };
