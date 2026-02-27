/**
 * VesselTripTimelineVertical: single-leg trip progress (arrive at A → at dock → depart A → at sea → arrive B).
 * Vertically aligned timeline with times displayed to the right of markers.
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
} from "../../shared";
import { vesselTripToTripSegment } from "../shared";

type VesselTripTimelineVerticalProps = {
  vesselLocation: VesselLocation;
  trip: VesselTripWithScheduledTrip;
  className?: string;
};

/**
 * Displays vessel trip progress vertically: arrive at origin → at-dock bar → depart → at-sea bar → arrive at destination.
 * Time information is displayed to the right of the timeline markers.
 *
 * @param vesselLocation - Real-time WSF data
 * @param trip - Actual/predicted trip data
 * @param className - Optional container className
 */
const VesselTripTimelineVertical = ({
  vesselLocation,
  trip,
  className,
}: VesselTripTimelineVerticalProps) => {
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
        "relative w-full flex-col items-center overflow-visible",
        className
      )}
      style={{ minHeight: 200 }}
    >
      {/* At Dock Segment */}
      <TimelineBlock
        duration={dockDuration}
        equalWidth={equalWidth}
        segmentCount={totalSegmentCount}
        orientation="vertical"
      >
        <StandardMarkerLayout
          rightContent={
            <TimeBox
              horizontal
              label={extractArriveCurrLabel(atDock)}
              scheduled={atDock.arriveCurr.scheduled}
              actual={atDock.arriveCurr.actual}
              estimated={atDock.arriveCurr.estimated}
            />
          }
          orientation="vertical"
          zIndex={10}
        />
        <TimelineBarAtDock
          segment={atDock}
          vesselLocation={vesselLocation}
          orientation="vertical"
        />
      </TimelineBlock>

      {/* At Sea Segment */}
      <TimelineBlock
        duration={seaDuration}
        equalWidth={equalWidth}
        segmentCount={totalSegmentCount}
        orientation="vertical"
      >
        <StandardMarkerLayout
          rightContent={
            <TimeBox
              horizontal
              label={extractDepartCurrLabel(atSea)}
              scheduled={atSea.leaveCurr.scheduled}
              actual={atSea.leaveCurr.actual}
              estimated={atSea.leaveCurr.estimated}
            />
          }
          orientation="vertical"
          zIndex={10}
        />
        <TimelineBarAtSea
          segment={atSea}
          vesselLocation={vesselLocation}
          orientation="vertical"
        />
        <StandardMarkerLayout
          rightContent={
            <TimeBox
              horizontal
              label={extractArriveNextLabel(atSea)}
              scheduled={atSea.arriveNext.scheduled}
              actual={atSea.arriveNext.actual}
              estimated={atSea.arriveNext.estimated}
            />
          }
          orientation="vertical"
          zIndex={10}
        />
      </TimelineBlock>
    </View>
  );
};

export default VesselTripTimelineVertical;
