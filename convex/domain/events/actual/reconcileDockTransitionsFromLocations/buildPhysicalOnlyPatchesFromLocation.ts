/**
 * Emits TripKey-only sparse writes for active trips with no schedule row.
 *
 * Some live trips do not yet (or no longer) have a schedule slice attached
 * (for example early-morning ops or cancellations). When motion gates pass on
 * the latest live sample, this module emits dock-event writes anchored only by
 * TripKey so downstream merge logic can persist the boundary without waiting
 * for schedule alignment. Boundaries already represented elsewhere are
 * skipped to avoid double writes.
 */

import type { ConvexVesselLocation } from "../../../../functions/vesselLocation/schemas";
import type { ActiveTripForPhysicalActualReconcile } from "../bindActualRowsToTrips";
import type { ConvexActualDockWritePersistable } from "../schemas";
import { strongArrival, strongDeparture } from "./locationMotionGates";

/**
 * Emits TripKey-only patches when schedule rows are absent but active trips exist.
 *
 * Skips boundaries already represented in representedTripBoundaryKeys so
 * duplicate schedule-aligned and physical-only emissions do not collide
 * during merge.
 *
 * @param location - Live sample evaluated for motion-based confirmation
 * @param activeTripsByVesselAbbrev - Active TripKey-only trips keyed by vessel
 * @param representedTripBoundaryKeys - TripKey and EventType pairs already covered
 * @returns Persistable sparse writes with TripKey set
 */
const buildPhysicalOnlyPatchesFromLocation = (
  location: ConvexVesselLocation,
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >,
  representedTripBoundaryKeys: Set<string>
): ConvexActualDockWritePersistable[] => {
  if (location.InService !== true) {
    return [];
  }

  const trip = activeTripsByVesselAbbrev.get(location.VesselAbbrev);
  if (!trip || trip.ScheduleKey !== undefined) {
    return [];
  }

  const patches: ConvexActualDockWritePersistable[] = [];

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|dep-dock`) &&
    strongDeparture(location)
  ) {
    patches.push({
      TripKey: trip.TripKey,
      VesselAbbrev: trip.VesselAbbrev,
      ...(trip.SailingDay !== undefined ? { SailingDay: trip.SailingDay } : {}),
      ...(trip.ScheduledDeparture !== undefined
        ? { ScheduledDeparture: trip.ScheduledDeparture }
        : {}),
      TerminalAbbrev: trip.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: location.LeftDock ?? location.TimeStamp,
    });
  }

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|arv-dock`) &&
    strongArrival(location) &&
    trip.ArrivingTerminalAbbrev !== undefined
  ) {
    patches.push({
      TripKey: trip.TripKey,
      VesselAbbrev: trip.VesselAbbrev,
      ...(trip.SailingDay !== undefined ? { SailingDay: trip.SailingDay } : {}),
      ...(trip.ScheduledDeparture !== undefined
        ? { ScheduledDeparture: trip.ScheduledDeparture }
        : {}),
      TerminalAbbrev: trip.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventOccurred: true,
      EventActualTime: location.TimeStamp,
    });
  }

  return patches;
};

export { buildPhysicalOnlyPatchesFromLocation };
