/**
 * Shared indexing and write helpers for the actual subtree.
 *
 * The actual stages use the same trip-key joins, vessel-keyed boundary groupings,
 * and physical-only write shape; this module concentrates those lookups so each
 * source-specific module stays focused on its own selection rules.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockWritePersistable } from "../../actual";
import { addMapListValue } from "../shared";
import type {
  ReloadScheduledBoundary,
  ReloadTripContext,
  ReloadTripWithTripKey,
} from "../types";

type ActualDockEventContext = {
  tripKeyBySegmentKey: Map<string, string>;
  physicalOnlyTrips: ReloadTripWithTripKey[];
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>;
  eventsByVessel: Map<string, ReloadScheduledBoundary[]>;
};

/**
 * Combines the orchestrator-built trip context with vessel-keyed boundary groupings.
 *
 * Each actual stage consumes lookups by vessel or segment, so this helper folds
 * the boundary group into the existing trip context once instead of forcing each
 * stage to re-walk the boundary array.
 *
 * @param tripContext - Trip-key indexes and physical-only collections from the orchestrator
 * @param boundaryEvents - Scheduled boundary records sorted in timeline order
 * @returns Composite lookups used by every actual source module
 */
const buildActualDockEventContext = (
  tripContext: ReloadTripContext,
  boundaryEvents: ReloadScheduledBoundary[]
): ActualDockEventContext => ({
  tripKeyBySegmentKey: tripContext.tripKeyBySegmentKey,
  physicalOnlyTrips: tripContext.physicalOnlyTrips,
  activePhysicalOnlyTripsByVessel: tripContext.activePhysicalOnlyTripsByVessel,
  eventsByVessel: groupEventsByVessel(boundaryEvents),
});

/**
 * Groups scheduled boundaries by vessel abbrev for tracking correlation.
 *
 * @param events - Scheduled boundary records for one sailing day
 * @returns Map from vessel abbrev to boundaries for that vessel across terminals
 */
const groupEventsByVessel = (
  events: ReloadScheduledBoundary[]
): Map<string, ReloadScheduledBoundary[]> => {
  const eventsByVesselAbbrev = events.reduce(
    (eventsByVessel, event) =>
      addMapListValue(eventsByVessel, event.VesselAbbrev, event),
    new Map<string, ReloadScheduledBoundary[]>()
  );

  return eventsByVesselAbbrev;
};

/**
 * Shapes one physical-only actual write from a trip and observed time.
 *
 * Used by both the physical-only trip projection and physical-only tracking
 * evidence so the persisted write carries the same identity fields regardless
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
