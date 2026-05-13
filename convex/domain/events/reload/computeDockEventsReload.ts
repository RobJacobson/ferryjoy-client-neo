/**
 * Computes the pure dock-events reload output from external WSF input and Convex DB
 * context gathered by the functions layer.
 */

import { computeReloadRowsFromScheduledEvents } from "./computeReloadRowsFromScheduledEvents";
import { hydrateScheduledEvents } from "./schedule";
import { indexTripsForReload } from "./trips";
import type { ComputeDockEventsReloadArgs, DockEventsReload } from "./types";

const computeDockEventsReload = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
  activeTrips,
  completedTrips,
  vesselLocations,
  updatedAt,
}: ComputeDockEventsReloadArgs): DockEventsReload => {
  const tripIndexes = indexTripsForReload({ activeTrips, completedTrips });
  const events = hydrateScheduledEvents({
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });
  const { scheduledRows, actualRows } = computeReloadRowsFromScheduledEvents({
    sailingDay,
    events,
    updatedAt,
    tripBySegmentKey: tripIndexes.tripBySegmentKey,
    activeTripsByVesselAbbrev: tripIndexes.activeTripsByVesselAbbrev,
    physicalOnlyTrips: tripIndexes.physicalOnlyTrips,
    vesselLocations,
  });

  return {
    sailingDay,
    scheduledRows,
    actualRows,
    physicalOnlyTripKeysToPreserve: new Set(
      tripIndexes.physicalOnlyTrips
        .map((trip) => trip.TripKey)
        .filter((tripKey): tripKey is string => tripKey !== undefined)
    ),
  };
};

export { computeDockEventsReload };
