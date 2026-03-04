/**
 * Card for arrival event at the starting terminal.
 * This card shows when the vessel arrived at the starting terminal.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import TimelineEvent from "./TimelineEvent";
import { TimelineLabel } from "./TimelineLabel";

type ArriveDockLabelProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders arrival event at the starting terminal.
 * This card shows when the vessel arrived at the starting terminal (arriveCurr).
 *
 * @param trip - Trip state used for arrival data
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Arrival card component
 */
export const ArriveDockLabel = ({
  trip,
  vesselLocation,
}: ArriveDockLabelProps) => {
  const actualTime = trip.TripStart;
  const scheduledTime = trip.ScheduledTrip?.SchedArriveCurr;
  return (
    <>
      <TimelineLabel
        title={`Arrived ${vesselLocation.DepartingTerminalAbbrev}`}
      />
      {actualTime && <TimelineEvent time={actualTime} type="actual" />}
      {scheduledTime && <TimelineEvent time={scheduledTime} type="scheduled" />}
    </>
  );
};
