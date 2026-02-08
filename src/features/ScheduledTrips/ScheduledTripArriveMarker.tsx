/**
 * Arrive marker for ScheduledTripTimeline: "Arrive/Arrived" + terminal.
 * Handles both origin (arrive at segment start) and destination (arrive at segment end).
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
import {
  getBestArrivalTime,
  getPredictedArriveNextTime,
} from "../Timeline/utils";

type ScheduledTripArriveMarkerProps = {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | undefined;
} & (
  | {
      variant: "origin";
      predictionTrip: VesselTrip | undefined;
      isPrevSegmentActive: boolean;
    }
  | {
      variant: "destination";
      isActive: boolean;
    }
);

/**
 * Renders the arrive marker for a segment (origin or destination terminal).
 * Uses actual arrival when available, else estimated; only uses vesselLocation
 * when the relevant leg is active.
 *
 * @param props - Segment, trip overlay, location, and variant-specific params
 * @returns TimelineMarker with "Arrive/Arrived" label and times
 */
export const ScheduledTripArriveMarker = (
  props: ScheduledTripArriveMarkerProps
) => {
  const { segment, actualTrip, vesselLocation } = props;

  const isOrigin = props.variant === "origin";
  const effectiveVesselLocation = isOrigin
    ? props.isPrevSegmentActive
      ? vesselLocation
      : undefined
    : props.isActive
      ? vesselLocation
      : undefined;
  const estimatedArrival = isOrigin
    ? getPredictedArriveNextTime(props.predictionTrip, effectiveVesselLocation)
    : getBestArrivalTime(effectiveVesselLocation, actualTrip);

  const actualTime = isOrigin ? actualTrip?.TripStart : actualTrip?.TripEnd;
  const terminalLabel = isOrigin
    ? segment.DepartingTerminalAbbrev
    : (segment.DisplayArrivingTerminalAbbrev ?? segment.ArrivingTerminalAbbrev);
  const scheduledTime = isOrigin
    ? segment.SchedArriveCurr
    : segment.SchedArriveNext;

  const displayTime = actualTime ?? estimatedArrival;

  return (
    <TimelineMarker zIndex={10}>
      <TimelineMarkerContent>
        <TimelineMarkerLabel
          text={`${actualTime ? "Arrived" : "Arrive"} ${terminalLabel}`}
        />
        <TimelineMarkerTime time={scheduledTime} type="scheduled" isBold />
        <TimelineMarkerTime
          time={displayTime}
          type={actualTime ? "actual" : "estimated"}
        />
      </TimelineMarkerContent>
    </TimelineMarker>
  );
};
