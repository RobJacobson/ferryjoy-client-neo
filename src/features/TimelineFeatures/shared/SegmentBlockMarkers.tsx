/**
 * Horizontal timeline markers for dock and sea blocks.
 * Arrive/Arrived and Leave/Left labels with scheduled/actual/estimated times.
 */

import TimelineMarker from "./TimelineMarker";
import TimelineMarkerContent from "./TimelineMarkerContent";
import TimelineMarkerLabel from "./TimelineMarkerLabel";
import TimelineMarkerTime from "./TimelineMarkerTime";
import type { AtDockSegment, AtSeaSegment, TimePoint } from "./types";

/**
 * Arrive marker for dock block: "Arrive/Arrived" at origin terminal.
 *
 * @param segment - AtDockSegment with arriveCurr at currTerminal
 */
export const ArriveCurrMarker = ({ segment }: { segment: AtDockSegment }) => (
  <MarkerBlock
    label={`${segment.arriveCurr.actual ? "Arrived" : "Arrive"} ${segment.currTerminal.abbrev}`}
    timePoint={segment.arriveCurr}
  />
);

/**
 * Arrive marker for sea block: "Arrive/Arrived" at destination terminal.
 *
 * @param segment - AtSeaSegment with arriveNext at nextTerminal
 */
export const ArriveNextMarker = ({ segment }: { segment: AtSeaSegment }) => (
  <MarkerBlock
    label={`${segment.arriveNext.actual ? "Arrived" : "Arrive"} ${segment.nextTerminal.abbrev}`}
    timePoint={segment.arriveNext}
  />
);

/**
 * Depart marker for sea block: "Leave/Left" from origin terminal.
 *
 * @param segment - AtSeaSegment with leaveCurr and currTerminal
 */
export const DepartCurrMarker = ({ segment }: { segment: AtSeaSegment }) => (
  <MarkerBlock
    label={`${segment.isLeft ? "Left" : "Leave"} ${segment.currTerminal.abbrev}`}
    timePoint={segment.leaveCurr}
  />
);

/**
 * Shared marker block for arrive/depart labels with scheduled and actual/estimated times.
 *
 * @param label - Display label (e.g. "Arrive ABC", "Left XYZ")
 * @param timePoint - TimePoint with scheduled, actual, and estimated
 */
const MarkerBlock = ({
  label,
  timePoint,
}: {
  label: string;
  timePoint: TimePoint;
}) => (
  <TimelineMarker zIndex={10}>
    <TimelineMarkerContent className="mt-[90px]">
      <TimelineMarkerLabel text={label} />
      <TimelineMarkerTime time={timePoint.scheduled} type="scheduled" isBold />
      <TimelineMarkerTime
        time={timePoint.actual ?? timePoint.estimated}
        type={timePoint.actual ? "actual" : "estimated"}
      />
    </TimelineMarkerContent>
  </TimelineMarker>
);
