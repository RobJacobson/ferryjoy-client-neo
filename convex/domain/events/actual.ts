import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";
import { getSailingDay } from "shared/time";

type ActualDockWriteAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

type ActualDockEventInput = {
  EventKey: string;
  TripKey: string;
  VesselAbbrev: string;
  SailingDay?: string;
  ScheduledDeparture?: number;
  TerminalAbbrev: string;
  EventType: ConvexActualDockEvent["EventType"];
  EventActualTime?: number;
};

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

const buildActualDockEvent = (
  input: ActualDockEventInput,
  updatedAt: number
): ConvexActualDockEvent => {
  const anchorMs = input.EventActualTime ?? input.ScheduledDeparture;
  if (anchorMs === undefined) {
    throw new Error("Actual dock event requires an anchor timestamp.");
  }

  const sailingDay = input.SailingDay ?? getSailingDay(new Date(anchorMs));
  const scheduledDeparture =
    input.ScheduledDeparture ?? input.EventActualTime ?? anchorMs;

  return {
    EventKey: input.EventKey,
    TripKey: input.TripKey,
    EventType: input.EventType,
    VesselAbbrev: input.VesselAbbrev,
    SailingDay: sailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: scheduledDeparture,
    TerminalAbbrev: input.TerminalAbbrev,
    EventOccurred: true,
    EventActualTime: input.EventActualTime,
  };
};

/**
 * Builds one persisted actual dock event from a sparse orchestrator write.
 *
 * EventKey defaults from TripKey and EventType when omitted. Other row timing
 * normalization is delegated to the canonical materializer.
 *
 * @param write - Persistable sparse actual dock write
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Validator-shaped eventsActual row ready for sparse upsert
 */
const buildActualDockEventFromWrite = (
  write: ConvexActualDockWritePersistable,
  updatedAt: number
): ConvexActualDockEvent =>
  buildActualDockEvent(
    {
      ...write,
      EventKey:
        write.EventKey ??
        buildPhysicalActualEventKey(write.TripKey, write.EventType),
    },
    updatedAt
  );

export type { ConvexActualDockWritePersistable };
export { buildActualDockEvent, buildActualDockEventFromWrite };
