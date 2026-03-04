/**
 * Label for departure event from the destination terminal.
 * Shows "Departed" or "Depart" with terminal name.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineLabel } from "./TimelineLabel";

type DepartDestLabelProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders departure label from the destination terminal.
 * This label shows when the vessel departs from the destination (departNext).
 *
 * @param trip - Trip state used for departure data
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Departure destination label component
 */
export const DepartDestLabel = ({
  trip,
  vesselLocation,
}: DepartDestLabelProps) => {
  const terminal = vesselLocation.ArrivingTerminalAbbrev;
  const hasDeparted = trip.AtDockDepartNext?.Actual !== undefined;
  const verb = hasDeparted ? "Departed" : "Depart";
  return <TimelineLabel title={`${verb} ${terminal}`} />;
};
