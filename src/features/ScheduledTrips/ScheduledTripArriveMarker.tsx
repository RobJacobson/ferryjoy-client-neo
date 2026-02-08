/**
 * Origin-arrive marker for ScheduledTripTimeline: "Arrive/Arrived" + DepartingTerminalAbbrev.
 * Label and TimeTwo use real-time data only (actual arrival, else estimated).
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
import { getPredictedArriveNextTime } from "../Timeline/utils";

/**
 * Renders the origin-arrive marker for a segment (arrive at departing terminal).
 * Uses actual TripStart when available, else estimated arrival from prediction trip.
 *
 * @param segment - Segment for this leg
 * @param actualTrip - VesselTrip overlay for this segment, if any
 * @param vesselLocation - Real-time vessel location, or undefined
 * @param predictionTrip - Prev-leg trip for estimated arrival (e.g. prevActualTrip when index === 0)
 * @returns TimelineMarker with "Arrive/Arrived" label and times
 */
export const ScheduledTripArriveMarker = ({
  segment,
  actualTrip,
  vesselLocation,
  predictionTrip,
}: {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | undefined;
  predictionTrip: VesselTrip | undefined;
}) => {
  const estimatedArrival = getPredictedArriveNextTime(
    predictionTrip,
    vesselLocation
  );

  return (
    <TimelineMarker zIndex={10}>
      <TimelineMarkerContent>
        <TimelineMarkerLabel
          text={`${actualTrip?.TripStart ? "Arrived" : "Arrive"} ${segment.DepartingTerminalAbbrev}`}
        />
        <TimelineMarkerTime
          time={segment.SchedArriveCurr}
          type="scheduled"
          isBold
        />
        <TimelineMarkerTime
          time={actualTrip?.TripStart ?? estimatedArrival}
          type={actualTrip?.TripStart ? "actual" : "estimated"}
        />
      </TimelineMarkerContent>
    </TimelineMarker>
  );
};
