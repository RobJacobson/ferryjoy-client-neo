/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments.
 * Selects markers and blocks for each segment.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import React, { useMemo } from "react";
import { View } from "react-native";
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
import { synthesizeTripSegments } from "../shared/utils";
import type { ScheduledTripJourney } from "./types";

type ScheduledTripTimelineProps = {
  journey: ScheduledTripJourney;
  vesselTripByKeys: Map<string, VesselTrip>;
  vesselLocation: VesselLocation | undefined;
  heldTrip?: VesselTrip;
};

/**
 * Displays a multi-segment timeline for scheduled ferry journeys.
 *
 * @param props - ScheduledTripTimelineProps
 * @returns View of horizontal timeline or null when no segments
 */
export const ScheduledTripTimeline = ({
  journey,
  vesselTripByKeys,
  vesselLocation,
  heldTrip,
}: ScheduledTripTimelineProps) => {
  const segments = useMemo(
    () =>
      synthesizeTripSegments({
        segments: journey.segments,
        vesselTripByKeys,
        vesselLocation,
        heldTrip,
      }),
    [journey.segments, vesselTripByKeys, vesselLocation, heldTrip]
  );

  if (segments.length === 0) return null;

  const totalSegmentCount = segments.length * 2;
  const equalWidth = totalSegmentCount === 4;

  return (
    <View className="relative w-full flex-row items-center overflow-visible px-4 py-8">
      {segments.map((segment) => {
        const dockDuration = Math.max(
          1,
          (segment.leaveCurr.scheduled.getTime() -
            segment.arriveCurr.scheduled.getTime()) /
            60000
        );
        const seaDuration =
          (segment.arriveNext.scheduled.getTime() -
            segment.leaveCurr.scheduled.getTime()) /
          60000;

        const atDock = toAtDockSegment(segment);
        const atSea = toAtSeaSegment(segment);

        return (
          <React.Fragment key={segment.id}>
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
              <TimelineBarAtDock
                segment={atDock}
                vesselLocation={vesselLocation}
              />
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
              <TimelineBarAtSea
                segment={atSea}
                vesselLocation={vesselLocation}
              />
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
          </React.Fragment>
        );
      })}
    </View>
  );
};
