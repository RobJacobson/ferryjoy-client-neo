/**
 * Label for arrival event at the destination terminal.
 * Shows "Arrived" or "Arrive" with terminal name.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineLabel } from "./TimelineLabel";

type ArriveDestLabelProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders arrival label at the destination terminal.
 * This label shows when the vessel arrives at the destination (arriveNext).
 *
 * @param trip - Trip state used for arrival data
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Arrival destination label component
 */
export const ArriveDestLabel = ({
  trip,
  vesselLocation,
}: ArriveDestLabelProps) => {
  const terminal = vesselLocation.ArrivingTerminalAbbrev;
  const hasArrived = trip.TripEnd !== undefined;
  const verb = hasArrived ? "Arrived" : "Arrive";
  return <TimelineLabel title={`${verb} ${terminal}`} />;
};
