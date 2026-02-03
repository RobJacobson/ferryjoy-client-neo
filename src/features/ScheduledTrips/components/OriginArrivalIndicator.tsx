/**
 * OriginArrivalIndicator component for displaying the predicted or actual arrival time at the origin terminal.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineDisplayTime } from "../../Timeline";
import type { Segment } from "../types";

type OriginArrivalIndicatorProps = {
  vesselAbbrev: string;
  firstSegment: Segment;
  vesselTripsByVessel: Map<string, VesselTrip[]>;
};

/**
 * Displays the predicted or actual arrival time at the origin terminal.
 * Considers both the vessel's own previous trip and any incoming vessel.
 */
export const OriginArrivalIndicator = ({
  vesselAbbrev,
  firstSegment,
  vesselTripsByVessel,
}: OriginArrivalIndicatorProps) => {
  const vesselTrips = vesselTripsByVessel.get(vesselAbbrev) || [];

  // Source 1: The vessel's own previous trip
  const arrivingTrip = vesselTrips.find(
    (t) =>
      t.ArrivingTerminalAbbrev === firstSegment.DepartingTerminalAbbrev &&
      (t.ScheduledTrip?.SchedArriveNext?.getTime() ===
        firstSegment.SchedArriveCurr?.getTime() ||
        t.ScheduledDeparture?.getTime() ===
          firstSegment.SchedArriveCurr?.getTime() ||
        t.ScheduledTrip?.DepartingTime.getTime() ===
          firstSegment.SchedArriveCurr?.getTime())
  );

  // Source 2: Any vessel currently heading to this terminal that will perform this trip next
  const incomingVesselTrip = vesselTrips.find(
    (t) =>
      t.ArrivingTerminalAbbrev === firstSegment.DepartingTerminalAbbrev &&
      (t.predictions.departNext?.time.getTime() ===
        firstSegment.DepartingTime.getTime() ||
        t.ScheduledTrip?.NextDepartingTime?.getTime() ===
          firstSegment.DepartingTime.getTime() ||
        t.ScheduledTrip?.SchedArriveNext?.getTime() ===
          firstSegment.DepartingTime.getTime() ||
        t.ScheduledDeparture?.getTime() ===
          firstSegment.DepartingTime.getTime() ||
        t.ScheduledTrip?.DepartingTime.getTime() ===
          firstSegment.DepartingTime.getTime())
  );

  const activeArrivingTrip = arrivingTrip || incomingVesselTrip;

  if (!activeArrivingTrip) return null;

  // If the vessel is already at the dock, we don't show the incoming arrival prediction
  if (
    activeArrivingTrip.AtDock &&
    activeArrivingTrip.DepartingTerminalAbbrev ===
      firstSegment.DepartingTerminalAbbrev
  ) {
    return null;
  }

  const prediction = activeArrivingTrip.predictions.arriveNext;
  if (!prediction) return null;

  return (
    <TimelineDisplayTime
      time={prediction.time}
      type={prediction.source === "ml" ? "estimated" : "actual"}
      bold={false}
    />
  );
};
