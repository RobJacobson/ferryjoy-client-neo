/**
 * Minimal actual event domain primitives used by vessel orchestration.
 *
 * Realtime trip updates emit sparse actual dock writes before persistence. This
 * module normalizes only that write shape into eventsActual rows; scheduled
 * reload sailing-day row assembly lives in domain/events/reload.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";
import { getSailingDay } from "shared/time";

type ActualDockWriteAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

type ConvexActualDockWritePersistable = {
  TripKey: string;
  VesselAbbrev: string;
  SailingDay?: string;
  TerminalAbbrev: string;
  SegmentKey?: string;
  EventType: ConvexActualDockEvent["EventType"];
  EventOccurred: true;
  EventKey?: string;
} & ActualDockWriteAnchor;

/**
 * Builds one persisted actual dock event from a sparse write.
 *
 * EventKey defaults from TripKey and EventType when omitted. SailingDay derives
 * from EventActualTime first, then ScheduledDeparture. Row ScheduledDeparture
 * prefers write.ScheduledDeparture, then EventActualTime, then the anchor ms.
 * At least one of EventActualTime or ScheduledDeparture must be present for
 * the calendar anchor (runtime guard; the persistable type encodes this).
 *
 * @param write - Persistable sparse actual dock write
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Validator-shaped eventsActual row ready for sparse upsert
 */
const buildActualDockEventFromWrite = (
  write: ConvexActualDockWritePersistable,
  updatedAt: number
): ConvexActualDockEvent => {
  let anchorMs: number;
  if (write.EventActualTime !== undefined) {
    anchorMs = write.EventActualTime;
  } else if (write.ScheduledDeparture !== undefined) {
    anchorMs = write.ScheduledDeparture;
  } else {
    throw new Error(
      "Persistable actual dock write requires an anchor timestamp."
    );
  }

  const eventKey =
    write.EventKey ??
    buildPhysicalActualEventKey(write.TripKey, write.EventType);
  const sailingDay = write.SailingDay ?? getSailingDay(new Date(anchorMs));
  const scheduledDeparture =
    write.ScheduledDeparture ?? write.EventActualTime ?? anchorMs;

  return {
    EventKey: eventKey,
    TripKey: write.TripKey,
    EventType: write.EventType,
    VesselAbbrev: write.VesselAbbrev,
    SailingDay: sailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: scheduledDeparture,
    TerminalAbbrev: write.TerminalAbbrev,
    EventOccurred: true,
    EventActualTime: write.EventActualTime,
  };
};

export type { ConvexActualDockWritePersistable };
export { buildActualDockEventFromWrite };
