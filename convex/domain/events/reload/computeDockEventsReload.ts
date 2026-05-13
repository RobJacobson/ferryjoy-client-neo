/**
 * Computes the pure dock-events reload output from external WSF input and Convex DB
 * context gathered by the functions layer.
 */

import { computeReloadRowsFromScheduledEvents } from "./computeReloadRowsFromScheduledEvents";
import { hydrateScheduledEvents } from "./schedule";
import { indexTripsForReload } from "./trips";
import type { ComputeDockEventsReloadArgs, DockEventsReload } from "./types";

/**
 * Builds the dock-events reload payload for one sailing day.
 *
 * Composes the three reload stages: index trips by segment and vessel,
 * hydrate scheduled events from WSF schedule and history, and project the
 * hydrated events plus indexes into Convex-shaped scheduled and actual rows.
 * The mutation layer consumes the returned payload directly, so the result
 * also surfaces the physical-only TripKeys that should survive scheduled-day
 * row replacement.
 *
 * @param args - WSF inputs, identity tables, trip context, and updatedAt stamp
 * @returns Scheduled rows, actual rows, and TripKeys to preserve during replace
 */
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
  // Precompute trip projections so downstream stages walk the trip arrays once.
  const tripIndexes = indexTripsForReload({ activeTrips, completedTrips });

  // Merge history before row assembly so observed actuals beat predicted times.
  const events = hydrateScheduledEvents({
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });

  // Project hydrated events plus trip context into the validator-shaped rows.
  const { scheduledRows, actualRows } = computeReloadRowsFromScheduledEvents({
    sailingDay,
    events,
    updatedAt,
    tripBySegmentKey: tripIndexes.tripBySegmentKey,
    activeTripsByVesselAbbrev: tripIndexes.activeTripsByVesselAbbrev,
    physicalOnlyTrips: tripIndexes.physicalOnlyTrips,
    vesselLocations,
  });

  // Surface physical-only TripKeys so the actual-row replace step preserves them.
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
