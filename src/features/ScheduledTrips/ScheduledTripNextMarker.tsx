/**
 * Next/destination arrive marker for ScheduledTripTimeline: "Arrive/Arrived" + ArrivingTerminalAbbrev.
 * Shows scheduled arrival at next terminal and actual or estimated arrival.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineMarker, TimelineMarkerlLabel } from "../Timeline";
import type { Segment } from "../Timeline/types";
import { getBestArrivalTime } from "../Timeline/utils";

/**
 * Renders the next/destination arrive marker for a segment (arrive at arriving terminal).
 * Uses actual TripEnd when available, else arrival prediction.
 *
 * @param segment - Segment for this leg
 * @param actualTrip - VesselTrip overlay for this segment, if any
 * @param vesselLocation - Real-time vessel location, or undefined
 * @returns TimelineMarker with "Arrive/Arrived" label and times
 */
export const ScheduledTripNextMarker = ({
  segment,
  actualTrip,
  vesselLocation,
}: {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | undefined;
}) => {
  const arrivalPrediction = getBestArrivalTime(vesselLocation, actualTrip);

  return (
    <TimelineMarker zIndex={10}>
      {() => (
        <TimelineMarkerlLabel
          LabelText={`${actualTrip?.TripEnd ? "Arrived" : "Arrive"} ${segment.DisplayArrivingTerminalAbbrev ?? segment.ArrivingTerminalAbbrev}`}
          TimeOne={
            segment.SchedArriveNext !== undefined
              ? {
                  time: segment.SchedArriveNext,
                  type: "scheduled",
                }
              : null
          }
          TimeTwo={
            (actualTrip?.TripEnd ?? arrivalPrediction) != null
              ? {
                  time:
                    actualTrip?.TripEnd ??
                    arrivalPrediction ??
                    segment.SchedArriveNext,
                  type: actualTrip?.TripEnd != null ? "actual" : "estimated",
                }
              : null
          }
        />
      )}
    </TimelineMarker>
  );
};
