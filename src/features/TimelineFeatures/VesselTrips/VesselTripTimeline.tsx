/**
 * VesselTripTimeline: single-leg trip progress (arrive at A → at dock → depart A → at sea → arrive B).
 * Selects markers and blocks for the segment.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import {
  extractArriveCurrLabel,
  extractArriveNextLabel,
  extractDepartCurrLabel,
  StandardMarkerLayout,
  TimeBox,
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineBlock,
  toAtDockSegment,
  toAtSeaSegment,
} from "../shared";
import { vesselTripToTripSegment } from "./vesselTripToTripSegment";

type VesselTripTimelineProps = {
  vesselLocation: VesselLocation;
  trip: VesselTripWithScheduledTrip;
  className?: string;
};

/**
 * Displays vessel trip progress: arrive at origin → at-dock bar → depart → at-sea bar → arrive at destination.
 *
 * @param vesselLocation - Real-time WSF data
 * @param trip - Actual/predicted trip data
 * @param className - Optional container className
 */
const VesselTripTimeline = ({
  vesselLocation,
  trip,
  className,
}: VesselTripTimelineProps) => {
  const tripSegment = vesselTripToTripSegment(trip, vesselLocation);
  const atDock = toAtDockSegment(tripSegment);
  const atSea = toAtSeaSegment(tripSegment);
  const totalSegmentCount = 2;
  const equalWidth = true;

  const dockDuration = Math.max(
    1,
    (atDock.leaveCurr.scheduled.getTime() -
      atDock.arriveCurr.scheduled.getTime()) /
      60000
  );
  const seaDuration =
    (atSea.arriveNext.scheduled.getTime() -
      atSea.leaveCurr.scheduled.getTime()) /
    60000;

  return (
    <View
      className={cn(
        "relative w-full flex-row items-center overflow-visible",
        className
      )}
      style={{ minHeight: 80 }}
    >
      <TimelineBlock
        duration={dockDuration}
        equalWidth={equalWidth}
        segmentCount={totalSegmentCount}
      >
        <StandardMarkerLayout
          belowContent={
            <TimeBox
              label={extractArriveCurrLabel(atDock)}
              scheduled={atDock.arriveCurr.scheduled}
              actual={atDock.arriveCurr.actual}
              estimated={atDock.arriveCurr.estimated}
            />
          }
          zIndex={10}
        />
        <TimelineBarAtDock segment={atDock} vesselLocation={vesselLocation} />
      </TimelineBlock>

      <TimelineBlock
        duration={seaDuration}
        equalWidth={equalWidth}
        segmentCount={totalSegmentCount}
      >
        <StandardMarkerLayout
          belowContent={
            <TimeBox
              label={extractDepartCurrLabel(atSea)}
              scheduled={atSea.leaveCurr.scheduled}
              actual={atSea.leaveCurr.actual}
              estimated={atSea.leaveCurr.estimated}
            />
          }
          zIndex={10}
        />
        <TimelineBarAtSea segment={atSea} vesselLocation={vesselLocation} />
        <StandardMarkerLayout
          belowContent={
            <TimeBox
              label={extractArriveNextLabel(atSea)}
              scheduled={atSea.arriveNext.scheduled}
              actual={atSea.arriveNext.actual}
              estimated={atSea.arriveNext.estimated}
            />
          }
          zIndex={10}
        />
      </TimelineBlock>
    </View>
  );
};

export default VesselTripTimeline;
