/**
 * Label for arrival event at the starting terminal.
 * Shows "Arrived" with terminal name.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { TimelineLabel } from "./TimelineLabel";

type ArriveDockLabelProps = {
  vesselLocation: VesselLocation;
};

/**
 * Renders arrival label at the starting terminal.
 * This label shows when the vessel arrived at the starting terminal (arriveCurr).
 *
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Arrival label component
 */
export const ArriveDockLabel = ({ vesselLocation }: ArriveDockLabelProps) => {
  return (
    <TimelineLabel
      title={`Arrived ${vesselLocation.DepartingTerminalAbbrev}`}
    />
  );
};
