import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";
import { buildEventId, sortVesselTripEvents } from "./liveUpdates";

/**
 * Builds the persistent event skeleton used by VesselTimeline.
 * Input trips should already be filtered to direct physical segments.
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
          EventId: buildEventId(
            trip.VesselAbbrev,
            ScheduledDeparture,
            "dep-dock"
          ),
          VesselAbbrev: trip.VesselAbbrev,
          SailingDay: trip.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: trip.DepartingTerminalAbbrev,
          EventType: "dep-dock" as const,
          ScheduledTime: trip.DepartingTime,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
        {
          EventId: buildEventId(
            trip.VesselAbbrev,
            ScheduledDeparture,
            "arv-dock"
          ),
          VesselAbbrev: trip.VesselAbbrev,
          SailingDay: trip.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: trip.ArrivingTerminalAbbrev,
          EventType: "arv-dock" as const,
          ScheduledTime: trip.ArrivingTime ?? trip.SchedArriveNext,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
      ];
    })
    .sort(sortVesselTripEvents);
