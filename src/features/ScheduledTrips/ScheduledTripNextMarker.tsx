/**
 * Next/destination arrive marker for ScheduledTripTimeline: "Arrive/Arrived" + ArrivingTerminalAbbrev.
 * Shows scheduled arrival at next terminal and actual or estimated arrival.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import {
  TimelineMarker,
  TimelineMarkerContent,
  TimelineMarkerLabel,
  TimelineMarkerTime,
} from "../Timeline";
import type { Segment } from "../Timeline/types";
import { getBestArrivalTime } from "../Timeline/utils";

/**
 * Renders the next/destination arrive marker for a segment (arrive at arriving terminal).
 * Uses actual TripEnd when available, else arrival prediction.
 * Only uses vesselLocation when this segment is active (ETA targets this destination).
 *
 * @param segment - Segment for this leg
 * @param actualTrip - VesselTrip overlay for this segment, if any
 * @param vesselLocation - Real-time vessel location, or undefined
 * @param isActive - True when the vessel is on this segment
 * @returns TimelineMarker with "Arrive/Arrived" label and times
 */
export const ScheduledTripNextMarker = ({
  segment,
  actualTrip,
  vesselLocation,
  isActive,
}: {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | undefined;
  isActive: boolean;
}) => {
  const effectiveVesselLocation = isActive ? vesselLocation : undefined;
  const arrivalPrediction = getBestArrivalTime(
    effectiveVesselLocation,
    actualTrip
  );

  return (
    <TimelineMarker zIndex={10}>
      <TimelineMarkerContent>
        <TimelineMarkerLabel
          text={`${actualTrip?.TripEnd ? "Arrived" : "Arrive"} ${segment.DisplayArrivingTerminalAbbrev ?? segment.ArrivingTerminalAbbrev}`}
        />
        <TimelineMarkerTime
          time={segment.SchedArriveNext}
          type="scheduled"
          isBold
        />
        <TimelineMarkerTime
          time={actualTrip?.TripEnd ?? arrivalPrediction}
          type={actualTrip?.TripEnd ? "actual" : "estimated"}
        />
      </TimelineMarkerContent>
    </TimelineMarker>
  );
};
