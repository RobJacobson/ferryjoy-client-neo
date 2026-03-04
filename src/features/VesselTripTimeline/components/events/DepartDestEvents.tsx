/**
 * Events for departure from the destination terminal.
 * Shows departure time with predicted and scheduled times.
 */

import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineEvents } from "./TimelineEvents";

type DepartDestEventsProps = {
  trip: VesselTripWithScheduledTrip;
};

/**
 * Renders departure events from the destination terminal.
 * These events show when the vessel departs from the destination (departNext).
 *
 * @param trip - Trip state used for departure data
 * @returns Departure destination events component
 */
export const DepartDestEvents = ({ trip }: DepartDestEventsProps) => (
  <TimelineEvents
    predictedTime={
      trip.AtSeaDepartNext?.PredTime ?? trip.AtDockDepartNext?.PredTime
    }
    scheduledTime={trip.ScheduledTrip?.NextDepartingTime}
  />
);
