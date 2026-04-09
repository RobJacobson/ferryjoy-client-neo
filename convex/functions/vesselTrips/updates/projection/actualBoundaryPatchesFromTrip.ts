/**
 * Builds sparse `eventsActual` boundary patches from a finalized active or
 * completed {@link ConvexVesselTrip}. Used on steady-state current-trip ticks
 * (leave-dock / arrive-dock events) and again at trip completion so departure
 * actuals can recover if an earlier leave-dock tick was missed.
 */

import type { ConvexActualBoundaryPatch } from "../../../eventsActual/schemas";
import type { ConvexVesselTrip } from "../../schemas";

type ActualBoundaryTerminalRole = "departing" | "arriving";

/**
 * Build a departure (`dep-dock`) actual patch when the trip has a key and
 * `LeftDock` timestamp.
 *
 * @param trip - Trip row with canonical segment identity and departure time
 * @returns Patch for projection, or `null` when required fields are missing
 */
export const buildDepartureActualPatchForTrip = (
  trip: ConvexVesselTrip
): ConvexActualBoundaryPatch | null =>
  buildActualBoundaryPatchFromTrip(
    trip,
    "dep-dock",
    trip.LeftDock,
    "departing"
  );

/**
 * Build an arrival (`arv-dock`) actual patch when the trip has a key and
 * `ArriveDest` timestamp.
 *
 * @param trip - Trip row with canonical segment identity and arrival time
 * @returns Patch for projection, or `null` when required fields are missing
 */
export const buildArrivalActualPatchForTrip = (
  trip: ConvexVesselTrip
): ConvexActualBoundaryPatch | null =>
  buildActualBoundaryPatchFromTrip(
    trip,
    "arv-dock",
    trip.ArriveDest,
    "arriving"
  );

/**
 * Shared guard + patch shape for trip-driven actual boundary patches.
 * Departure always reads `DepartingTerminalAbbrev` (required on the trip row).
 * Arrival uses optional `ArrivingTerminalAbbrev` and returns null when absent.
 *
 * @param trip - Trip row supplying segment identity and terminal fields
 * @param eventType - Boundary kind for projection
 * @param actualTime - Epoch ms for the boundary (`LeftDock` or `ArriveDest`)
 * @param terminalRole - Which terminal field to use and how strictly to validate
 * @returns Patch for projection, or `null` when required fields are missing
 */
const buildActualBoundaryPatchFromTrip = (
  trip: ConvexVesselTrip,
  eventType: ConvexActualBoundaryPatch["EventType"],
  actualTime: number | undefined,
  terminalRole: ActualBoundaryTerminalRole
): ConvexActualBoundaryPatch | null => {
  if (
    !trip.Key ||
    !trip.SailingDay ||
    trip.ScheduledDeparture === undefined ||
    actualTime === undefined
  ) {
    return null;
  }

  let terminalAbbrevForPatch: string;
  if (terminalRole === "departing") {
    terminalAbbrevForPatch = trip.DepartingTerminalAbbrev;
  } else if (trip.ArrivingTerminalAbbrev) {
    terminalAbbrevForPatch = trip.ArrivingTerminalAbbrev;
  } else {
    return null;
  }

  return {
    SegmentKey: trip.Key,
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: terminalAbbrevForPatch,
    EventType: eventType,
    EventOccurred: true,
    EventActualTime: actualTime,
  };
};
