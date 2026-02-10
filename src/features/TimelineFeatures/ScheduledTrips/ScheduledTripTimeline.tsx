/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * ScheduledTrips owns composition (like VesselTrips) and uses only Timeline primitives.
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

type ScheduledTripTimelineProps = {
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
};

/**
 * Displays a multi-segment timeline for scheduled ferry journeys, composing Timeline primitives
 * directly from synthesized TripSegment objects.
 *
 * @param props - ScheduledTripTimelineProps
 * @returns View of horizontal timeline or null when no segments
 */
export const ScheduledTripTimeline = ({
  journey,
  vesselTripMap,
  vesselLocation,
  heldTrip,
}: ScheduledTripTimelineProps) => {
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

  // Two timeline segments per journey segment (at-dock + at-sea)
  const totalSegmentCount = segments.length * 2;
  const equalWidth = totalSegmentCount === 4;

  return (
    <View className="relative flex-row items-center w-full overflow-visible px-4 py-8">
      {segments.map((segment) => {
        // Duration for layout (using scheduled times to keep bars consistent)
        // Ensure a minimum duration of 1 minute for the dock segment to prevent marker overlap
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
                vesselLocation={vesselLocation}
                showIndicator={segment.phase === "at-dock"}
              />
            </TimelineSegment>

            <TimelineSegment
              duration={seaDuration}
              equalWidth={equalWidth}
              segmentCount={totalSegmentCount}
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
                  // Only show "Arrived" when we have actual arrival at destination, not when held at origin.
                  segment.phase !== "at-sea" && !!segment.arriveNext.actual
                }
                isHeld={segment.isHeld}
                predictionEndTimeMs={segment.arriveNext.estimated?.getTime()}
                vesselLocation={vesselLocation}
                animate={segment.phase === "at-sea"}
                showIndicator={
                  segment.phase === "at-sea" ||
                  (segment.isHeld && segment.phase === "completed")
                }
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

/**
 * Arrive marker for ScheduledTripTimeline: "Arrive/Arrived" + terminal.
 * Handles both origin (arrive at segment start) and destination (arrive at segment end).
 *
 * @param terminalAbbrev - Terminal abbrev
 * @param arriveTime - Time point for arrival
 * @param isArrived - Whether the vessel has already arrived
 * @returns TimelineMarker with "Arrive/Arrived" label and times
 */
const ScheduledTripArriveMarker = ({
  terminalAbbrev,
  arriveTime,
  isArrived,
}: {
  terminalAbbrev: string;
  arriveTime: TimePoint;
  isArrived: boolean;
}) => (
  <TimelineMarker zIndex={10}>
    <TimelineMarkerContent className="mt-[90px]">
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

/**
 * Depart marker for ScheduledTripTimeline: "Depart/Left" + DepartingTerminalAbbrev.
 * Shows scheduled departure and actual or estimated departure time.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @param leaveTime - Time point for departure
 * @param isLeft - Whether the vessel has already left
 * @returns TimelineMarker with "Depart/Left" label and times
 */
const ScheduledTripDepartMarker = ({
  terminalAbbrev,
  leaveTime,
  isLeft,
}: {
  terminalAbbrev: string;
  leaveTime: TimePoint;
  isLeft: boolean;
}) => (
  <TimelineMarker zIndex={10}>
    <TimelineMarkerContent className="mt-[90px]">
      <TimelineMarkerLabel
        text={`${isLeft ? "Left" : "Leave"} ${terminalAbbrev}`}
      />
      <TimelineMarkerTime time={leaveTime.scheduled} type="scheduled" isBold />
      <TimelineMarkerTime
        time={leaveTime.actual ?? leaveTime.estimated}
        type={leaveTime.actual ? "actual" : "estimated"}
      />
    </TimelineMarkerContent>
  </TimelineMarker>
);
