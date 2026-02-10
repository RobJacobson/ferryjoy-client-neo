/**
 * ScheduledTripTimelineVertical renders a vertical sequence of scheduled trip segments.
 * Fixed height container with markers on left/right of the central track.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import React, { useMemo } from "react";
import { View } from "react-native";
import {
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineMarker,
  TimelineMarkerContent,
  TimelineMarkerLabel,
  TimelineMarkerTime,
  TimelineSegment,
} from "../Timeline";
import type { TimePoint } from "../Timeline/types";
import type { ScheduledTripJourney } from "./types";
import { synthesizeTripSegments } from "./utils/synthesizeTripSegments";

// ============================================================================
// Main Component
// ============================================================================

type ScheduledTripTimelineVerticalProps = {
  /**
   * Scheduled journey data.
   */
  journey: ScheduledTripJourney;
  /**
   * Unified map of segment Key to VesselTrip (actuals/predictions).
   */
  vesselTripMap: Map<string, VesselTrip>;
  /**
   * Real-time vessel location.
   */
  vesselLocation: VesselLocation | undefined;
  /**
   * The trip currently being held (if any).
   */
  heldTrip?: VesselTrip;
  /**
   * Fixed height for the vertical timeline.
   */
  height?: number;
};

/**
 * Displays a vertical multi-segment timeline for scheduled ferry journeys.
 *
 * @param props - ScheduledTripTimelineVerticalProps
 * @returns View of vertical timeline or null when no segments
 */
export const ScheduledTripTimelineVertical = ({
  journey,
  vesselTripMap,
  vesselLocation,
  heldTrip,
  height = 250,
}: ScheduledTripTimelineVerticalProps) => {
  const segments = useMemo(
    () =>
      synthesizeTripSegments({
        segments: journey.segments,
        vesselTripMap,
        vesselLocation,
        heldTrip,
      }),
    [journey.segments, vesselTripMap, vesselLocation, heldTrip]
  );

  if (segments.length === 0) return null;

  const totalSegmentCount = segments.length * 2;
  const equalWidth = totalSegmentCount === 4;

  return (
    <View
      className="relative items-center w-full overflow-visible"
      style={{ height, paddingVertical: 20 }}
    >
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

        return (
          <React.Fragment key={segment.id}>
            <TimelineSegment
              duration={dockDuration}
              equalWidth={equalWidth}
              segmentCount={totalSegmentCount}
              orientation="vertical"
            >
              <ScheduledTripArriveMarker
                terminalAbbrev={segment.currTerminal.abbrev}
                arriveTime={segment.arriveCurr}
                isArrived={!!segment.arriveCurr.actual}
              />

              <TimelineBarAtDock
                startTimeMs={segment.arriveCurr.scheduled.getTime()}
                endTimeMs={segment.leaveCurr.scheduled.getTime()}
                status={
                  segment.phase === "at-dock"
                    ? "InProgress"
                    : segment.status === "past" ||
                        segment.phase === "at-sea" ||
                        segment.phase === "completed"
                      ? "Completed"
                      : "Pending"
                }
                isArrived={segment.isArrived}
                isHeld={segment.isHeld}
                predictionEndTimeMs={segment.leaveCurr.estimated?.getTime()}
                vesselName={segment.vesselName}
                atDockAbbrev={
                  segment.phase === "at-dock"
                    ? segment.currTerminal.abbrev
                    : undefined
                }
                showIndicator={segment.phase === "at-dock"}
                orientation="vertical"
              />
            </TimelineSegment>

            <TimelineSegment
              duration={seaDuration}
              equalWidth={equalWidth}
              segmentCount={totalSegmentCount}
              orientation="vertical"
            >
              <ScheduledTripDepartMarker
                terminalAbbrev={segment.currTerminal.abbrev}
                leaveTime={segment.leaveCurr}
                isLeft={segment.isLeft}
              />

              <TimelineBarAtSea
                startTimeMs={segment.leaveCurr.scheduled.getTime()}
                endTimeMs={segment.arriveNext.scheduled.getTime()}
                status={
                  segment.phase === "at-sea"
                    ? "InProgress"
                    : segment.status === "past" || segment.phase === "completed"
                      ? "Completed"
                      : "Pending"
                }
                isArrived={
                  segment.phase !== "at-sea" && !!segment.arriveNext.actual
                }
                isHeld={segment.isHeld}
                predictionEndTimeMs={segment.arriveNext.estimated?.getTime()}
                vesselName={segment.vesselName}
                animate={segment.phase === "at-sea"}
                speed={segment.speed}
                departingDistance={segment.departingDistance}
                arrivingDistance={segment.arrivingDistance}
                showIndicator={
                  segment.phase === "at-sea" ||
                  (segment.isHeld && segment.phase === "completed")
                }
                orientation="vertical"
              />

              <ScheduledTripArriveMarker
                terminalAbbrev={segment.nextTerminal.abbrev}
                arriveTime={segment.arriveNext}
                isArrived={!!segment.arriveNext.actual}
              />
            </TimelineSegment>
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ============================================================================
// Internal Helper Components
// ============================================================================

const ScheduledTripArriveMarker = ({
  terminalAbbrev,
  arriveTime,
  isArrived,
}: {
  terminalAbbrev: string;
  arriveTime: TimePoint;
  isArrived: boolean;
}) => (
  <TimelineMarker zIndex={10} orientation="vertical">
    <TimelineMarkerContent className="mr-[380px] flex-row items-center justify-end gap-x-2">
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

const ScheduledTripDepartMarker = ({
  terminalAbbrev,
  leaveTime,
  isLeft,
}: {
  terminalAbbrev: string;
  leaveTime: TimePoint;
  isLeft: boolean;
}) => (
  <TimelineMarker zIndex={10} orientation="vertical">
    <TimelineMarkerContent className="ml-[380px] flex-row items-center justify-start gap-x-2">
      <TimelineMarkerLabel
        text={`${isLeft ? "Left" : "Leave"} ${terminalAbbrev}`}
      />
      <View className="flex-col items-end start gap-x-2">
        <TimelineMarkerTime
          time={leaveTime.scheduled}
          type="scheduled"
          isBold
        />
        <TimelineMarkerTime
          time={leaveTime.actual ?? leaveTime.estimated}
          type={leaveTime.actual ? "actual" : "estimated"}
        />
      </View>
    </TimelineMarkerContent>
  </TimelineMarker>
);
