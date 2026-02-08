/**
 * Depart marker for ScheduledTripTimeline: "Depart/Left" + DepartingTerminalAbbrev.
 * Shows scheduled departure and actual or estimated departure time.
 */

import {
  TimelineMarker,
  TimelineMarkerContent,
  TimelineMarkerLabel,
  TimelineMarkerTime,
} from "../Timeline";
import type { TimePoint } from "../Timeline/types";

/**
 * Renders the depart marker for a segment (left/depart from terminal).
 * Uses the clean TripSegment data structure.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @param leaveTime - Time point for departure
 * @param isLeft - Whether the vessel has already left
 * @returns TimelineMarker with "Depart/Left" label and times
 */
export const ScheduledTripDepartMarker = ({
  terminalAbbrev,
  leaveTime,
  isLeft,
}: {
  terminalAbbrev: string;
  leaveTime: TimePoint;
  isLeft: boolean;
}) => (
  <TimelineMarker zIndex={10}>
    <TimelineMarkerContent>
      <TimelineMarkerLabel
        text={`${isLeft ? "Left" : "Depart"} ${terminalAbbrev}`}
      />
      <TimelineMarkerTime time={leaveTime.scheduled} type="scheduled" isBold />
      <TimelineMarkerTime
        time={leaveTime.actual ?? leaveTime.estimated}
        type={leaveTime.actual ? "actual" : "estimated"}
      />
    </TimelineMarkerContent>
  </TimelineMarker>
);
