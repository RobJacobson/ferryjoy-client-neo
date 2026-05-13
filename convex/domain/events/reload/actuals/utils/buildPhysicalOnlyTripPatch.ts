/**
 * Shapes sparse actual dock writes for physical-only trip boundaries.
 *
 * Physical-only reload paths can observe boundaries from trip rows or live
 * locations, but both need the same eventsActual write shape before the
 * shared actual-event normalizer stamps keys and calendar fields.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockWritePersistable } from "../../../actual";
import type { ReloadTripForActuals } from "../../types";

type PhysicalOnlyTripWithTripKey = ReloadTripForActuals & {
  TripKey: string;
};

/**
 * Shapes one physical-only actual write from a trip and observed time.
 *
 * Centralizes the sparse write contract for physical-only reload sources so
 * trip-row evidence and live-location evidence cannot drift in their TripKey,
 * sailing day, terminal, or boundary fields before normalization.
 *
 * @param trip - Physical-only trip with TripKey
 * @param terminalAbbrev - Terminal hosting the boundary
 * @param eventType - Dock boundary discriminator
 * @param eventActualTime - Observed time in epoch milliseconds
 * @returns Persistable actual dock write
 */
const buildPhysicalOnlyTripPatch = (
  trip: PhysicalOnlyTripWithTripKey,
  terminalAbbrev: string,
  eventType: DockEventType,
  eventActualTime: number
): ConvexActualDockWritePersistable => ({
  TripKey: trip.TripKey,
  VesselAbbrev: trip.VesselAbbrev,
  SailingDay: trip.SailingDay,
  ScheduledDeparture: trip.ScheduledDeparture,
  TerminalAbbrev: terminalAbbrev,
  EventType: eventType,
  EventOccurred: true,
  EventActualTime: eventActualTime,
});

export { buildPhysicalOnlyTripPatch };
