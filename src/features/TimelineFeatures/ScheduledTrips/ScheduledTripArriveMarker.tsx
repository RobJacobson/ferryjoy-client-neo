/**
 * Arrive marker for ScheduledTripTimeline: "Arrive/Arrived" + terminal.
 * Handles both origin (arrive at segment start) and destination (arrive at segment end).
 */

import {
  TimelineMarker,
  TimelineMarkerContent,
  TimelineMarkerLabel,
  TimelineMarkerTime,
} from "../Timeline";
import type { TimePoint } from "../Timeline/types";

type ScheduledTripArriveMarkerProps = {
  terminalAbbrev: string;
  arriveTime: TimePoint;
  isArrived: boolean;
};

/**
 * Renders the arrive marker for a segment (origin or destination terminal).
 * Uses the clean TripSegment data structure.
 *
 * @param props - Terminal abbrev, time point, and arrived status
 * @returns TimelineMarker with "Arrive/Arrived" label and times
 */
export const ScheduledTripArriveMarker = ({
  terminalAbbrev,
  arriveTime,
  isArrived,
}: ScheduledTripArriveMarkerProps) => (
  <TimelineMarker zIndex={10}>
    <TimelineMarkerContent>
      <TimelineMarkerLabel
        text={`${isArrived ? "Arrived" : "Arrive"} ${terminalAbbrev}`}
      />
      <TimelineMarkerTime time={arriveTime.scheduled} type="scheduled" isBold />
      <TimelineMarkerTime
        time={arriveTime.actual ?? arriveTime.estimated}
        type={arriveTime.actual ? "actual" : "estimated"}
      />
    </TimelineMarkerContent>
  </TimelineMarker>
);
