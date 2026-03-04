/**
 * Events for arrival at the destination terminal.
 * Shows arrival time with actual (if past) or predicted (if future) times.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { getPredictedArriveNextTime } from "@/features/TimelineFeatures/shared/utils";
import { TimelineEvents } from "./TimelineEvents";

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
}: ArriveDestEventsProps) => (
  <TimelineEvents
    actualTime={trip.TripEnd}
    scheduledTime={trip.ScheduledTrip?.SchedArriveNext}
    predictedTime={getPredictedArriveNextTime(trip, vesselLocation)}
  />
);
