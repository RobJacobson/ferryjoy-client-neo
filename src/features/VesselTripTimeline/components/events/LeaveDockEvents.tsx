/**
 * Events for departure from the starting terminal.
 * Shows departure time with actual (if past) or predicted (if future) times.
 */

import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineEvent, TimelineEventView } from "./TimelineEvent";

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
export const LeaveDockEvents = ({ trip }: LeaveDockEventsProps) => {
  const actualTime = trip.LeftDock;
  const scheduledTime = trip.ScheduledDeparture;
  const predictedTime = trip.AtDockDepartCurr?.PredTime;
  return (
    <TimelineEventView>
      {actualTime && <TimelineEvent time={actualTime} type="actual" />}
      {!actualTime && predictedTime && (
        <TimelineEvent time={predictedTime} type="estimated" />
      )}
      {scheduledTime && <TimelineEvent time={scheduledTime} type="scheduled" />}
    </TimelineEventView>
  );
};
