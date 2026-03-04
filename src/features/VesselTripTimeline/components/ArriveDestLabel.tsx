/**
 * Card for arrival event at the destination terminal.
 * Shows arrival time with actual (if past) or predicted (if future) times.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { getPredictedArriveNextTime } from "@/features/TimelineFeatures/shared/utils";
import TimelineEvent from "./TimelineEvent";
import { TimelineLabel } from "./TimelineLabel";

type ArrivalDestCardProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders arrival event at the destination terminal.
 * This card shows when the vessel arrives at the destination (arriveNext).
 *
 * @param trip - Trip state used for arrival data
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Arrival destination card component
 */
export const ArriveDestLabel = ({
  trip,
  vesselLocation,
}: ArrivalDestCardProps) => {
  const terminal = vesselLocation.ArrivingTerminalAbbrev;
  const hasArrived = trip.TripEnd !== undefined;
  const verb = hasArrived ? "Arrived" : "Arrive";
  const scheduledTime = trip.ScheduledTrip?.SchedArriveNext;
  const predictedTime = getPredictedArriveNextTime(trip, vesselLocation);
  const actualTime = trip.TripEnd;
  return (
    <>
      <TimelineLabel title={`${verb} ${terminal}`} />
      {actualTime && <TimelineEvent time={actualTime} type="actual" />}
      {!actualTime && predictedTime && (
        <TimelineEvent time={predictedTime} type="estimated" />
      )}
      {scheduledTime && <TimelineEvent time={scheduledTime} type="scheduled" />}
    </>
  );
};
