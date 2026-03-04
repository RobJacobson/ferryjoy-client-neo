/**
 * Card for departure event from the starting terminal.
 * Shows departure time with actual (if past) or predicted (if future) times.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import TimelineEvent from "./TimelineEvent";
import { TimelineLabel } from "./TimelineLabel";

type DepartStartCardProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders departure event from the starting terminal.
 * This card shows when the vessel leaves the starting terminal (leaveCurr).
 *
 * @param trip - Trip state used for departure data
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Departure start card component
 */
export const LeaveDockLabel = ({
  trip,
  vesselLocation,
}: DepartStartCardProps) => {
  const actualTime = trip.LeftDock;
  const scheduledTime = trip.ScheduledDeparture;
  const predictedTime = trip.AtDockDepartCurr?.PredTime;
  const verb = actualTime ? "Departed" : "Depart";
  return (
    <>
      <TimelineLabel
        title={`${verb} ${vesselLocation.DepartingTerminalAbbrev}`}
      />
      {actualTime && <TimelineEvent time={actualTime} type="actual" />}
      {!actualTime && predictedTime && (
        <TimelineEvent time={predictedTime} type="estimated" />
      )}
      {scheduledTime && <TimelineEvent time={scheduledTime} type="scheduled" />}
    </>
  );
};
