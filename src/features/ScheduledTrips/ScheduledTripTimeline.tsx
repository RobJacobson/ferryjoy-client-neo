/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * ScheduledTrips owns composition (like VesselTrips) and uses only Timeline primitives.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import React from "react";
import { View } from "react-native";
import { TimelineBarAtDock, TimelineBarAtSea } from "../Timeline";
import type { TimelineBarStatus } from "../Timeline/TimelineBar";
import type {
  Segment,
  TimelineActivePhase,
  TimelineSegmentStatus,
} from "../Timeline/types";
import { getBestArrivalTime, getBestDepartureTime } from "../Timeline/utils";
import { ScheduledTripArriveMarker } from "./ScheduledTripArriveMarker";
import { ScheduledTripDepartMarker } from "./ScheduledTripDepartMarker";
import type { ScheduledTripTimelineState } from "./utils/computePageDisplayState";

// ============================================================================
// Segment display flags helper
// ============================================================================

type TimelineForFlags = {
  activeKey: string | null;
  activePhase: TimelineActivePhase;
};

/**
 * Computes display flags for a segment in the timeline.
 *
 * @param params.segment - The segment to compute flags for
 * @param params.index - Segment index in the journey
 * @param params.segmentCount - Total number of segments in the journey
 * @param params.legStatus - Segment status (Completed/InProgress/Pending)
 * @param params.timeline - Timeline state with activeKey and activePhase
 * @param params.actualTrip - VesselTrip overlay for this segment, if any
 * @returns Display flags for bars, markers, and block visibility
 */
const computeSegmentDisplayFlags = (params: {
  segment: Segment;
  index: number;
  segmentCount: number;
  legStatus: TimelineSegmentStatus;
  timeline: TimelineForFlags;
  actualTrip: VesselTrip | undefined;
}): {
  isActive: boolean;
  isHeld: boolean;
  originDockStatus: TimelineBarStatus;
  atSeaStatus: TimelineBarStatus;
  showAtDockMarker: boolean;
  showAtSeaMarker: boolean;
  showOriginBlock: boolean;
  showNextDockBlock: boolean;
} => {
  const { segment, index, segmentCount, legStatus, timeline, actualTrip } =
    params;

  const isActive =
    timeline.activeKey != null && timeline.activeKey === segment.Key;
  const isHeld = isActive && !!actualTrip?.TripEnd;

  const originDockStatus: TimelineBarStatus =
    legStatus === "Completed"
      ? "Completed"
      : isActive && timeline.activePhase === "AtDock" && !isHeld
        ? "InProgress"
        : isActive
          ? "Completed"
          : "Pending";

  const atSeaStatus: TimelineBarStatus =
    legStatus === "Completed"
      ? "Completed"
      : isHeld
        ? "Completed"
        : isActive && timeline.activePhase === "AtSea"
          ? "InProgress"
          : "Pending";

  const showAtDockMarker =
    isActive && timeline.activePhase === "AtDock" && !isHeld;
  const showAtSeaMarker =
    isActive && (timeline.activePhase === "AtSea" || isHeld);

  const showOriginBlock = index === 0;
  const showNextDockBlock =
    index < segmentCount - 1 && segment.NextDepartingTime != null;

  return {
    isActive,
    isHeld,
    originDockStatus,
    atSeaStatus,
    showAtDockMarker,
    showAtSeaMarker,
    showOriginBlock,
    showNextDockBlock,
  };
};

// ============================================================================
// Timeline props
// ============================================================================

type ScheduledTripTimelineProps = {
  /**
   * Segments for this journey, in segment order. Overlay trips looked up via vesselTripMap + PrevKey/NextKey.
   */
  segments: Segment[];
  /**
   * Map of segment Key to VesselTrip for O(1) lookup. PrevKey/NextKey used for prev/next trips.
   */
  vesselTripMap: Map<string, VesselTrip>;
  /**
   * Timeline state for this journey (activeKey, activePhase, statusByKey).
   */
  timeline: ScheduledTripTimelineState;
  /**
   * Real-time vessel location when available; undefined for schedule-only rendering.
   */
  vesselLocation: VesselLocation | undefined;
};

/**
 * Displays a multi-segment timeline for scheduled ferry journeys, composing Timeline primitives
 * directly from segments and page-level display state (flat rendering, VesselTrips-style).
 * Uses vesselTripMap + PrevKey/NextKey for prev/next trip lookups.
 *
 * @param segments - Segments for this journey
 * @param vesselTripMap - Map of segment Key to VesselTrip for overlay lookups
 * @param timeline - Timeline state for this journey
 * @param vesselLocation - Real-time vessel location, or undefined when unavailable
 * @returns View of horizontal timeline or null when no segments
 */
export const ScheduledTripTimeline = ({
  segments,
  vesselTripMap,
  timeline,
  vesselLocation,
}: ScheduledTripTimelineProps) => {
  if (segments.length === 0) return null;

  return (
    <View className="relative flex-row items-center justify-between w-full overflow-visible px-4 py-8">
      {segments.map((segment, index) => {
        const actualTrip = vesselTripMap.get(segment.Key);
        const prevActualTrip = vesselTripMap.get(segment.PrevKey ?? "");
        const nextActualTrip = vesselTripMap.get(segment.NextKey ?? "");
        const predictionTrip = index === 0 ? prevActualTrip : undefined;

        const legStatus: TimelineSegmentStatus =
          timeline.statusByKey.get(segment.Key) ?? "Pending";

        const flags = computeSegmentDisplayFlags({
          segment,
          index,
          segmentCount: segments.length,
          legStatus,
          timeline,
          actualTrip,
        });

        const arrivalPrediction = getBestArrivalTime(
          vesselLocation,
          actualTrip
        );
        const departurePrediction = getBestDepartureTime(
          vesselLocation,
          actualTrip
        );

        return (
          <React.Fragment key={segment.Key}>
            {flags.showOriginBlock && (
              <>
                <ScheduledTripArriveMarker
                  variant="origin"
                  segment={segment}
                  actualTrip={actualTrip}
                  vesselLocation={vesselLocation}
                  predictionTrip={predictionTrip}
                  isPrevSegmentActive={
                    segment.PrevKey != null &&
                    timeline.activeKey === segment.PrevKey
                  }
                />

                <TimelineBarAtDock
                  startTimeMs={
                    actualTrip?.TripStart?.getTime() ??
                    segment.SchedArriveCurr?.getTime()
                  }
                  endTimeMs={
                    actualTrip?.LeftDock?.getTime() ??
                    segment.DepartingTime.getTime()
                  }
                  status={flags.originDockStatus}
                  isArrived={flags.originDockStatus === "Completed"}
                  isHeld={false}
                  predictionEndTimeMs={
                    flags.isActive && timeline.activePhase === "AtDock"
                      ? departurePrediction?.getTime()
                      : undefined
                  }
                  vesselName={vesselLocation?.VesselName}
                  atDockAbbrev={
                    flags.isActive &&
                    timeline.activePhase === "AtDock" &&
                    !flags.isHeld
                      ? segment.DepartingTerminalAbbrev
                      : undefined
                  }
                  showIndicator={flags.showAtDockMarker}
                />
              </>
            )}

            <ScheduledTripDepartMarker
              segment={segment}
              actualTrip={actualTrip}
              vesselLocation={vesselLocation}
              prevActualTrip={prevActualTrip}
              predictionTrip={predictionTrip}
            />

            <TimelineBarAtSea
              startTimeMs={
                actualTrip?.TripStart?.getTime() ??
                segment.DepartingTime.getTime()
              }
              endTimeMs={
                actualTrip?.TripEnd?.getTime() ?? arrivalPrediction?.getTime()
              }
              status={flags.atSeaStatus}
              isArrived={flags.isHeld}
              isHeld={flags.isHeld}
              predictionEndTimeMs={
                flags.isActive &&
                timeline.activePhase === "AtSea" &&
                arrivalPrediction != null
                  ? arrivalPrediction.getTime()
                  : undefined
              }
              departingDistance={vesselLocation?.DepartingDistance}
              arrivingDistance={vesselLocation?.ArrivingDistance}
              vesselName={vesselLocation?.VesselName}
              animate={
                flags.isActive &&
                timeline.activePhase === "AtSea" &&
                !flags.isHeld
              }
              speed={vesselLocation?.Speed}
              showIndicator={flags.showAtSeaMarker}
            />

            <ScheduledTripArriveMarker
              variant="destination"
              segment={segment}
              actualTrip={actualTrip}
              vesselLocation={vesselLocation}
              isActive={flags.isActive}
            />

            {flags.showNextDockBlock && (
              <TimelineBarAtDock
                startTimeMs={
                  nextActualTrip?.TripStart?.getTime() ??
                  segment.NextDepartingTime?.getTime()
                }
                endTimeMs={
                  nextActualTrip?.TripEnd?.getTime() ??
                  arrivalPrediction?.getTime()
                }
                status={legStatus === "Completed" ? "Completed" : "Pending"}
                isArrived={legStatus === "Completed"}
                predictionEndTimeMs={
                  flags.isActive &&
                  timeline.activePhase === "AtDock" &&
                  actualTrip?.AtDockDepartNext != null
                    ? actualTrip.AtDockDepartNext.PredTime.getTime()
                    : undefined
                }
                vesselName={vesselLocation?.VesselName}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};
