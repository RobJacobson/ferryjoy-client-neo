/**
 * Events for arrival at the destination terminal.
 * Shows arrival time with actual (if past) or predicted (if future) times.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { getPredictedArriveNextTime } from "@/features/TimelineFeatures/shared/utils";
import { TimelineEvent, TimelineEventView } from "./TimelineEvent";

type ArriveDestEventsProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders arrival events at the destination terminal.
 * These events show when the vessel arrives at the destination (arriveNext).
 *
 * @param trip - Trip state used for arrival data
 * @param vesselLocation - Vessel location used for predictions
 * @returns Arrival destination events component
 */
export const ArriveDestEvents = ({
  trip,
  vesselLocation,
}: ArriveDestEventsProps) => {
  const scheduledTime = trip.ScheduledTrip?.SchedArriveNext;
  const predictedTime = getPredictedArriveNextTime(trip, vesselLocation);
  const actualTime = trip.TripEnd;
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
