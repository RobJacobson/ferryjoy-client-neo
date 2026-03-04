/**
 * Events for departure from the starting terminal.
 * Shows departure time with actual (if past) or predicted (if future) times.
 */

import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineEvents } from "./TimelineEvents";

type LeaveDockEventsProps = {
  trip: VesselTripWithScheduledTrip;
};

/**
 * Renders departure events from the starting terminal.
 * These events show when the vessel leaves the starting terminal (leaveCurr).
 *
 * @param trip - Trip state used for departure data
 * @returns Departure events component
 */
export const LeaveDockEvents = ({ trip }: LeaveDockEventsProps) => (
  <TimelineEvents
    actualTime={trip.LeftDock}
    scheduledTime={trip.ScheduledDeparture}
    predictedTime={trip.AtDockDepartCurr?.PredTime}
  />
);
