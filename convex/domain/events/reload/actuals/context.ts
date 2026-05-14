/**
 * Shared indexing and write helpers for the actuals subtree.
 *
 * The actuals stages use the same trip-key joins, vessel-keyed boundary groupings,
 * and physical-only write shape; this module concentrates those lookups so each
 * source-specific module stays focused on its own selection rules.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockWritePersistable } from "../../actual";
import { addMapListValue } from "../collectionHelpers";
import type {
  DockStatusEventRecord,
  ReloadTripContext,
  ReloadTripWithTripKey,
} from "../types";

type ActualDockEventContext = {
  tripKeyBySegmentKey: Map<string, string>;
  physicalOnlyTrips: ReloadTripWithTripKey[];
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>;
  eventsByVessel: Map<string, DockStatusEventRecord[]>;
};

/**
 * Combines the orchestrator-built trip context with vessel-keyed boundary groupings.
 *
 * Each actuals stage consumes lookups by vessel or segment, so this helper folds
 * the boundary group into the existing trip context once instead of forcing each
 * stage to re-walk the boundary array.
 *
 * @param tripContext - Trip-key indexes and physical-only collections from the orchestrator
 * @param boundaryEvents - Hydrated boundary records sorted in timeline order
 * @returns Composite lookups used by every actuals source module
 */
const buildActualDockEventContext = (
  tripContext: ReloadTripContext,
  boundaryEvents: DockStatusEventRecord[]
): ActualDockEventContext => ({
  tripKeyBySegmentKey: tripContext.tripKeyBySegmentKey,
  physicalOnlyTrips: tripContext.physicalOnlyTrips,
  activePhysicalOnlyTripsByVessel: tripContext.activePhysicalOnlyTripsByVessel,
  eventsByVessel: groupEventsByVessel(boundaryEvents),
});

/**
 * Groups boundary records by vessel abbrev for location ping correlation.
 *
 * @param events - Hydrated boundary records for one sailing day
 * @returns Map from vessel abbrev to events for that vessel across terminals
 */
const groupEventsByVessel = (
  events: DockStatusEventRecord[]
): Map<string, DockStatusEventRecord[]> => {
  const eventsByVesselAbbrev = events.reduce(
    (eventsByVessel, event) =>
      addMapListValue(eventsByVessel, event.VesselAbbrev, event),
    new Map<string, DockStatusEventRecord[]>()
  );

  return eventsByVesselAbbrev;
};

/**
 * Shapes one physical-only actual write from a trip and observed time.
 *
 * Used by both the physical-only trip projection and the physical-only location
 * fallback so the persisted write carries the same identity fields regardless
 * of which evidence path emitted it.
 *
 * @param trip - Physical-only trip with TripKey
 * @param terminalAbbrev - Terminal hosting the boundary
 * @param eventType - Dock boundary discriminator
 * @param eventActualTime - Observed time in epoch milliseconds
 * @returns Persistable actual dock write
 */
const buildPhysicalOnlyActualWrite = (
  trip: ReloadTripWithTripKey,
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

export type { ActualDockEventContext };
export { buildActualDockEventContext, buildPhysicalOnlyActualWrite };
