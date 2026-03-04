/**
 * Label for departure event from the starting terminal.
 * Shows "Departed" or "Depart" with terminal name.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineLabel } from "./TimelineLabel";

type LeaveDockLabelProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders departure label from the starting terminal.
 * This label shows when the vessel leaves the starting terminal (leaveCurr).
 *
 * @param trip - Trip state used for departure data
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Departure label component
 */
export const LeaveDockLabel = ({
  trip,
  vesselLocation,
}: LeaveDockLabelProps) => {
  const actualTime = trip.LeftDock;
  const verb = actualTime ? "Departed" : "Depart";
  return (
    <TimelineLabel
      title={`${verb} ${vesselLocation.DepartingTerminalAbbrev}`}
    />
  );
};
