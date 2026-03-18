/**
 * Builds schedule-derived vessel trip event rows for the `vesselTripEvents`
 * read model.
 */
import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";
import { buildEventKey, sortVesselTripEvents } from "./liveUpdates";

/**
 * Builds the persistent dock-boundary event skeleton used by
 * `VesselTimeline`.
 *
 * @param trips - Scheduled trips for one sailing day before read-model merge
 * @returns Sorted departure and arrival boundary rows for direct trips only
 */
export const buildSeedVesselTripEvents = (
  trips: ConvexScheduledTrip[]
): ConvexVesselTripEvent[] =>
  trips
    .filter((trip) => trip.TripType === "direct")
    .flatMap((trip) => {
      const ScheduledDeparture = trip.DepartingTime;

      return [
        {
          Key: buildEventKey(
            trip.SailingDay,
            trip.VesselAbbrev,
            ScheduledDeparture,
            trip.DepartingTerminalAbbrev,
            "dep-dock"
          ),
          VesselAbbrev: trip.VesselAbbrev,
          SailingDay: trip.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: trip.DepartingTerminalAbbrev,
          EventType: "dep-dock" as const,
          // Departure rows always use the scheduled departure timestamp.
          ScheduledTime: trip.DepartingTime,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
        {
          Key: buildEventKey(
            trip.SailingDay,
            trip.VesselAbbrev,
            ScheduledDeparture,
            trip.DepartingTerminalAbbrev,
            "arv-dock"
          ),
          VesselAbbrev: trip.VesselAbbrev,
          SailingDay: trip.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: trip.ArrivingTerminalAbbrev,
          EventType: "arv-dock" as const,
          // Arrival rows fall back to the next-day schedule field when needed.
          ScheduledTime: trip.ArrivingTime ?? trip.SchedArriveNext,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
      ];
    })
    .sort(sortVesselTripEvents);
