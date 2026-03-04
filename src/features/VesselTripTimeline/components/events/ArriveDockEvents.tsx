/**
 * Events for arrival at the starting terminal.
 * Shows arrival time with actual or scheduled times.
 */

import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineEvents } from "./TimelineEvents";

type ArriveDockEventsProps = {
  trip: VesselTripWithScheduledTrip;
};

/**
 * Renders arrival events at the starting terminal.
 * These events show when the vessel arrived at the starting terminal (arriveCurr).
 *
 * @param trip - Trip state used for arrival data
 * @returns Arrival events component
 */
export const ArriveDockEvents = ({ trip }: ArriveDockEventsProps) => (
  <TimelineEvents
    actualTime={trip.TripStart}
    scheduledTime={trip.ScheduledTrip?.SchedArriveCurr}
  />
);
