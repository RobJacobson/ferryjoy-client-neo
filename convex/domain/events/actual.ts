/**
 * Minimal actual event domain primitives used by vessel orchestration.
 *
 * Realtime trip updates emit sparse actual dock writes before persistence. This
 * module normalizes only that write shape into eventsActual rows; scheduled
 * reload slice assembly lives in domain/events/reload.
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
 * from EventActualTime first, then ScheduledDeparture, and ScheduledDeparture
 * falls back to EventActualTime so physical-only writes remain persistable.
 *
 * @param write - Persistable sparse actual dock write
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Validator-shaped eventsActual row ready for sparse upsert
 */
const buildActualDockEventFromWrite = (
  write: ConvexActualDockWritePersistable,
  updatedAt: number
): ConvexActualDockEvent => {
  const anchorMs = getActualDockWriteAnchorMs(write);
  const eventKey =
    write.EventKey ??
    buildPhysicalActualEventKey(write.TripKey, write.EventType);
  const sailingDay = write.SailingDay ?? getSailingDay(new Date(anchorMs));
  const scheduledDeparture = write.ScheduledDeparture ?? anchorMs;

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

/**
 * Resolves the timestamp anchor from a persistable actual dock write.
 *
 * @param write - Persistable sparse actual dock write
 * @returns EventActualTime when present, otherwise ScheduledDeparture
 */
const getActualDockWriteAnchorMs = (
  write: ConvexActualDockWritePersistable
): number => {
  if (write.EventActualTime !== undefined) {
    return write.EventActualTime;
  }

  if (write.ScheduledDeparture !== undefined) {
    return write.ScheduledDeparture;
  }

  throw new Error(
    "Persistable actual dock write requires an anchor timestamp."
  );
};

export type { ConvexActualDockWritePersistable };
export { buildActualDockEventFromWrite };
