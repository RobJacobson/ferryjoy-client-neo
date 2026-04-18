/**
 * Builds sparse `eventsActual` dock writes from a finalized active or completed
 * {@link ConvexVesselTripWithPredictions}. Used on steady-state current-trip ticks
 * (leave-dock / arrive-dock events) and again at trip completion so departure
 * actuals can recover if an earlier leave-dock tick was missed.
 */

import type { ConvexActualDockWritePersistable } from "domain/events/actual/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";

type DockTerminalRole = "departing" | "arriving";

/**
 * Build a departure (`dep-dock`) actual dock write when the trip has `TripKey`
 * and a departure timestamp.
 *
 * Reads the canonical physical departure boundary (`LeftDockActual`).
 *
 * @param trip - Trip row with physical identity and departure time
 * @returns Write for projection, or `null` when required fields are missing
 */
export const buildDepartureActualDockWriteForTrip = (
  trip: ConvexVesselTripWithPredictions
): ConvexActualDockWritePersistable | null =>
  buildActualDockWriteFromTrip(
    trip,
    "dep-dock",
    trip.LeftDockActual,
    "departing"
  );

/**
 * Build an arrival (`arv-dock`) actual dock write when the trip has `TripKey`
 * and `ArrivedNextActual` timestamp.
 *
 * Completed-trip projection expects trip lifecycle code to have already
 * backfilled `ArrivingTerminalAbbrev` from the physical arrival dock when the
 * voyage finished without a safe schedule match.
 *
 * @param trip - Trip row with physical identity and arrival time
 * @returns Write for projection, or `null` when required fields are missing
 */
export const buildArrivalActualDockWriteForTrip = (
  trip: ConvexVesselTripWithPredictions
): ConvexActualDockWritePersistable | null =>
  buildActualDockWriteFromTrip(
    trip,
    "arv-dock",
    trip.ArrivedNextActual,
    "arriving"
  );

/**
 * Shared guard + write shape for trip-driven actual dock writes.
 * Departure always reads `DepartingTerminalAbbrev` (required on the trip row).
 * Arrival uses optional `ArrivingTerminalAbbrev` and returns null when absent.
 * `SailingDay` / `ScheduledDeparture` may be omitted on the trip row; the
 * normalized row builder derives them from `actualTime`.
 *
 * @param trip - Trip row supplying physical identity and terminal fields
 * @param eventType - Dock kind for projection
 * @param actualTime - Epoch ms for the boundary (`LeftDockActual` or `ArrivedNextActual`)
 * @param terminalRole - Which terminal field to use and how strictly to validate
 * @returns Write for projection, or `null` when required fields are missing
 */
const buildActualDockWriteFromTrip = (
  trip: ConvexVesselTripWithPredictions,
  eventType: ConvexActualDockWritePersistable["EventType"],
  actualTime: number | undefined,
  terminalRole: DockTerminalRole
): ConvexActualDockWritePersistable | null => {
  if (!trip.TripKey || actualTime === undefined) {
    return null;
  }

  let terminalAbbrevForWrite: string;
  if (terminalRole === "departing") {
    terminalAbbrevForWrite = trip.DepartingTerminalAbbrev;
  } else if (trip.ArrivingTerminalAbbrev) {
    terminalAbbrevForWrite = trip.ArrivingTerminalAbbrev;
  } else {
    return null;
  }

  return {
    SegmentKey: trip.ScheduleKey,
    TripKey: trip.TripKey,
    ScheduleKey: trip.ScheduleKey,
    VesselAbbrev: trip.VesselAbbrev,
    ...(trip.SailingDay !== undefined ? { SailingDay: trip.SailingDay } : {}),
    ...(trip.ScheduledDeparture !== undefined
      ? { ScheduledDeparture: trip.ScheduledDeparture }
      : {}),
    TerminalAbbrev: terminalAbbrevForWrite,
    EventType: eventType,
    EventOccurred: true,
    EventActualTime: actualTime,
  };
};
