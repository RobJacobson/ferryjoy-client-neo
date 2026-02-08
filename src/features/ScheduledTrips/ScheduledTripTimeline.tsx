/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * ScheduledTrips owns composition (like VesselTrips) and uses only Timeline primitives.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import React from "react";
import { View } from "react-native";
import {
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineMarker,
  TimelineMarkerlLabel,
} from "../Timeline";
import {
  TIMELINE_CIRCLE_SIZE,
  TIMELINE_MARKER_CLASS,
} from "../Timeline/config";
import type { TimelineBarStatus } from "../Timeline/TimelineBar";
import type {
  Segment,
  TimelineActivePhase,
  TimelineSegmentStatus,
} from "../Timeline/types";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getBestNextDepartureTime,
  getPredictedArriveNextTime,
} from "../Timeline/utils";
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
// Marker primitive types (narrow per marker)
// ============================================================================

type OriginArriveMarkerPrimitives = {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | null;
  predictionTrip: VesselTrip | undefined;
};

type DepartMarkerPrimitives = {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | null;
  prevActualTrip: VesselTrip | undefined;
  predictionTrip: VesselTrip | undefined;
  nowMs: number;
};

type DestinationArriveMarkerPrimitives = {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | null;
  nowMs: number;
};

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
   * Real-time vessel location when available; null for schedule-only rendering.
   */
  vesselLocation: VesselLocation | null;
};

/**
 * Displays a multi-segment timeline for scheduled ferry journeys, composing Timeline primitives
 * directly from segments and page-level display state (flat rendering, VesselTrips-style).
 * Uses vesselTripMap + PrevKey/NextKey for prev/next trip lookups.
 *
 * @param segments - Segments for this journey
 * @param vesselTripMap - Map of segment Key to VesselTrip for overlay lookups
 * @param timeline - Timeline state for this journey
 * @param vesselLocation - Real-time vessel location, or null
 * @returns View of horizontal timeline or null when no segments
 */
export const ScheduledTripTimeline = ({
  segments,
  vesselTripMap,
  timeline,
  vesselLocation,
}: ScheduledTripTimelineProps) => {
  if (segments.length === 0) return null;

  const nowMs = vesselLocation?.TimeStamp?.getTime() ?? Date.now();

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
          vesselLocation ?? undefined,
          actualTrip
        );
        const departurePrediction = getBestDepartureTime(
          vesselLocation ?? undefined,
          actualTrip
        );

        return (
          <React.Fragment key={segment.Key}>
            {flags.showOriginBlock && (
              <>
                <OriginArriveMarker
                  segment={segment}
                  actualTrip={actualTrip}
                  vesselLocation={vesselLocation}
                  predictionTrip={predictionTrip}
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

            <DepartMarker
              segment={segment}
              actualTrip={actualTrip}
              vesselLocation={vesselLocation}
              prevActualTrip={prevActualTrip}
              predictionTrip={predictionTrip}
              nowMs={nowMs}
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

            <DestinationArriveMarker
              segment={segment}
              actualTrip={actualTrip}
              vesselLocation={vesselLocation}
              nowMs={nowMs}
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

// ============================================================================
// Marker label components (ScheduledTrips-owned)
// ============================================================================

/**
 * Origin arrive marker: "Arrive/Arrived" + DepartingTerminalAbbrev.
 * Label and TimeTwo use real-time data only (actual arrival, else estimated).
 */
const OriginArriveMarker = ({
  segment,
  actualTrip,
  vesselLocation,
  predictionTrip,
}: OriginArriveMarkerPrimitives) => {
  // predictionTrip is prevActualTrip when index === 0 (trip for segment.PrevKey).
  const estimatedArrival =
    !actualTrip && vesselLocation && !vesselLocation.AtDock && predictionTrip
      ? getPredictedArriveNextTime(predictionTrip, vesselLocation)
      : undefined;

  return (
    <TimelineMarker
      size={TIMELINE_CIRCLE_SIZE}
      className={TIMELINE_MARKER_CLASS}
      zIndex={10}
    >
      {() => (
        <TimelineMarkerlLabel
          LabelText={`${actualTrip?.TripStart ? "Arrived" : "Arrive"} ${segment.DepartingTerminalAbbrev}`}
          TimeOne={
            segment.SchedArriveCurr !== undefined
              ? {
                  time: segment.SchedArriveCurr,
                  type: "scheduled",
                }
              : null
          }
          TimeTwo={
            actualTrip?.TripStart
              ? { time: actualTrip.TripStart, type: "actual" }
              : estimatedArrival != null
                ? { time: estimatedArrival, type: "estimated" }
                : null
          }
        />
      )}
    </TimelineMarker>
  );
};

/**
 * Depart marker: "Depart/Left" + DepartingTerminalAbbrev.
 * Localized state: departInPast, departurePrediction, departNextPrediction.
 */
const DepartMarker = ({
  segment,
  actualTrip,
  vesselLocation,
  prevActualTrip,
  predictionTrip,
  nowMs,
}: DepartMarkerPrimitives) => {
  const departInPast =
    !!actualTrip?.LeftDock || segment.DepartingTime.getTime() < nowMs;
  const departurePrediction = getBestDepartureTime(
    vesselLocation ?? undefined,
    actualTrip
  );
  const departNextPrediction = getBestNextDepartureTime(
    prevActualTrip ?? predictionTrip
  );
  const isHistoricalMatch = actualTrip !== undefined;

  return (
    <TimelineMarker
      size={TIMELINE_CIRCLE_SIZE}
      className={TIMELINE_MARKER_CLASS}
      zIndex={10}
    >
      {() => (
        <TimelineMarkerlLabel
          LabelText={`${departInPast ? "Left" : "Depart"} ${segment.DepartingTerminalAbbrev}`}
          TimeOne={{ time: segment.DepartingTime, type: "scheduled" }}
          TimeTwo={
            isHistoricalMatch &&
            (actualTrip?.LeftDock ?? departurePrediction) != null
              ? {
                  time:
                    actualTrip?.LeftDock ??
                    departurePrediction ??
                    segment.DepartingTime,
                  type: actualTrip?.LeftDock != null ? "actual" : "estimated",
                }
              : !isHistoricalMatch && departNextPrediction != null
                ? {
                    time: departNextPrediction,
                    type: "estimated",
                  }
                : null
          }
        />
      )}
    </TimelineMarker>
  );
};

/**
 * Destination arrive marker: "Arrive/Arrived" + ArrivingTerminalAbbrev.
 * Localized state: destArriveInPast, arrivalPrediction.
 */
const DestinationArriveMarker = ({
  segment,
  actualTrip,
  vesselLocation,
  nowMs,
}: DestinationArriveMarkerPrimitives) => {
  const destArriveInPast =
    !!actualTrip?.TripEnd ||
    (segment.SchedArriveNext != null &&
      segment.SchedArriveNext.getTime() < nowMs);
  const arrivalPrediction = getBestArrivalTime(
    vesselLocation ?? undefined,
    actualTrip
  );
  const isHistoricalMatch = actualTrip !== undefined;

  return (
    <TimelineMarker
      size={TIMELINE_CIRCLE_SIZE}
      className={TIMELINE_MARKER_CLASS}
      zIndex={10}
    >
      {() => (
        <TimelineMarkerlLabel
          LabelText={`${destArriveInPast ? "Arrived" : "Arrive"} ${segment.DisplayArrivingTerminalAbbrev ?? segment.ArrivingTerminalAbbrev}`}
          TimeOne={
            segment.SchedArriveNext !== undefined
              ? {
                  time: segment.SchedArriveNext,
                  type: "scheduled",
                }
              : null
          }
          TimeTwo={
            isHistoricalMatch &&
            (actualTrip?.TripEnd ?? arrivalPrediction) != null
              ? {
                  time:
                    actualTrip?.TripEnd ??
                    arrivalPrediction ??
                    segment.SchedArriveNext,
                  type: actualTrip?.TripEnd != null ? "actual" : "estimated",
                }
              : null
          }
        />
      )}
    </TimelineMarker>
  );
};
