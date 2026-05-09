/**
 * Composes schedule or history hydration with hydrated-event slice assembly.
 */

import { buildReloadDockSliceFromHydratedEvents } from "./buildReloadDockSliceFromHydratedEvents";
import { buildHydratedDockBoundaryEventsForReload } from "./scheduleSeedAndHydration";
import type { BuildReloadDockRowSliceArgs } from "./types";

/**
 * Builds scheduled and actual dock rows from raw reload schedule and history.
 *
 * @param args - Schedule, history, identities, trip indexes, and locations
 * @returns Scheduled and actual rows plus operator-facing counts
 */
const buildReloadDockRowSlice = (args: BuildReloadDockRowSliceArgs) => {
  const hydratedEvents = buildHydratedDockBoundaryEventsForReload({
    scheduleSegments: args.scheduleSegments,
    historyRecords: args.historyRecords,
    vessels: args.vessels,
    terminals: args.terminals,
  });
  return buildReloadDockSliceFromHydratedEvents({
    sailingDay: args.sailingDay,
    events: hydratedEvents,
    updatedAt: args.updatedAt,
    tripBySegmentKey: args.tripBySegmentKey,
    activeTripsByVesselAbbrev: args.activeTripsByVesselAbbrev,
    physicalOnlyTrips: args.physicalOnlyTrips,
    vesselLocations: args.vesselLocations,
  });
};

export { buildReloadDockRowSlice };
