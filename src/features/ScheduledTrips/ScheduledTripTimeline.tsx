/**
 * ScheduledTripTimeline renders a sequence of scheduled trip segments (departure → stops → destination).
 * ScheduledTrips owns composition (like VesselTrips) and uses only Timeline primitives.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import React from "react";
import { View } from "react-native";
import { getSailingDay } from "@/shared/utils/getSailingDay";
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
import type { TimelineSegmentStatus } from "../Timeline/types";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getBestNextDepartureTime,
  getPredictedArriveNextTime,
} from "../Timeline/utils";
import type { SegmentTuple } from "./types";
import type { ScheduledTripCardDisplayState } from "./utils/computePageDisplayState";

type ScheduledTripTimelineProps = {
  /**
   * Segment tuples for this journey, one per scheduled segment, in segment order.
   * Each tuple contains the scheduled segment plus optional overlay trip matched by Key.
   */
  segmentTuples: SegmentTuple[];
  /**
   * Page-level display state for this journey (active selection + segment statuses + inbound prediction wiring).
   */
  displayState: ScheduledTripCardDisplayState;
  /**
   * Real-time vessel location when available; null for schedule-only rendering.
   */
  vesselLocation: VesselLocation | null;
};

/**
 * Displays a multi-segment timeline for scheduled ferry journeys, composing Timeline primitives
 * directly from segment tuples and page-level display state (flat rendering, VesselTrips-style).
 *
 * @param segmentTuples - Segment tuples for this journey
 * @param displayState - Page-level display state for this journey
 * @param vesselLocation - Real-time vessel location, or null
 * @returns View of horizontal timeline or null when no tuples
 */
export const ScheduledTripTimeline = ({
  segmentTuples,
  displayState,
  vesselLocation,
}: ScheduledTripTimelineProps) => {
  if (segmentTuples.length === 0) return null;

  const { timeline, inboundTripForFirstSegment } = displayState;
  const nowMs = vesselLocation?.TimeStamp?.getTime() ?? Date.now();

  return (
    <View className="relative flex-row items-center justify-between w-full overflow-visible px-4 py-8">
      {segmentTuples.map((tuple, index) => {
        const { segment, actualTrip } = tuple;
        const prevActualTrip = segmentTuples[index - 1]?.actualTrip;
        const nextActualTrip = segmentTuples[index + 1]?.actualTrip;
        const predictionTrip =
          index === 0 ? inboundTripForFirstSegment : undefined;

        const legStatus: TimelineSegmentStatus =
          timeline.statusByKey.get(segment.Key) ?? "Pending";

        const isFirst = index === 0;
        const isLast = index === segmentTuples.length - 1;
        const isActive =
          timeline.activeKey != null && timeline.activeKey === segment.Key;
        const isHeld = isActive && !!actualTrip?.TripEnd;

        const legState = getSegmentLegDerivedStateInline({
          segment,
          vesselLocation,
          actualTrip,
          prevActualTrip,
          predictionTrip,
          nowMs,
        });

        // Origin dock: Completed if journey done or leg done; InProgress if active and at dock (not held).
        const originDockStatus: TimelineSegmentStatus =
          legStatus === "Completed"
            ? "Completed"
            : isActive && timeline.activePhase === "AtDock" && !isHeld
              ? "InProgress"
              : isActive
                ? "Completed"
                : "Pending";

        // At-sea: Completed if held or journey done; InProgress if active and at sea; else Pending.
        const atSeaStatus: TimelineSegmentStatus =
          legStatus === "Completed"
            ? "Completed"
            : isHeld
              ? "Completed"
              : isActive && timeline.activePhase === "AtSea"
                ? "InProgress"
                : "Pending";

        // Render if exists: use actual times when we have a historical match;
        // otherwise fall back to scheduled times (graceful degradation when overlay absent).
        const originDockStartMs =
          (legState.isHistoricalMatch && actualTrip?.TripStart?.getTime()) ||
          segment.SchedArriveCurr?.getTime();
        const originDockEndMs =
          (legState.isHistoricalMatch && actualTrip?.LeftDock?.getTime()) ||
          segment.DepartingTime.getTime();
        const atSeaStartMs =
          (legState.isHistoricalMatch &&
            (actualTrip?.LeftDock?.getTime() ||
              actualTrip?.TripStart?.getTime())) ||
          segment.DepartingTime.getTime();
        const atSeaEndMs =
          (legState.isHistoricalMatch &&
            (actualTrip?.TripEnd?.getTime() ||
              legState.arrivalPrediction?.getTime())) ||
          segment.SchedArriveNext?.getTime();
        const nextDockStartMs =
          (legState.isHistoricalMatch && actualTrip?.TripEnd?.getTime()) ||
          segment.SchedArriveNext?.getTime();
        const nextDockEndMs =
          (legState.isHistoricalMatch &&
            nextActualTrip?.TripStart?.getTime()) ||
          segment.NextDepartingTime?.getTime();

        // First segment shows origin dock (arrive at terminal); last segment has no "next dock" block.
        const showOriginBlock = isFirst;
        const showNextDockBlock = !isLast && segment.NextDepartingTime != null;

        return (
          <React.Fragment key={segment.Key}>
            {showOriginBlock && (
              <>
                <TimelineMarker
                  size={TIMELINE_CIRCLE_SIZE}
                  className={TIMELINE_MARKER_CLASS}
                  zIndex={10}
                >
                  {() => (
                    <TimelineMarkerlLabel
                      LabelText={`${legState.originArriveInPast ? "Arrived" : "Arrive"} ${segment.DepartingTerminalAbbrev}`}
                      TimeOne={
                        segment.SchedArriveCurr !== undefined
                          ? ({
                              time: segment.SchedArriveCurr,
                              type: "scheduled",
                            })
                          : null
                      }
                      TimeTwo={
                        legState.showOriginActualTime && actualTrip?.TripStart
                          ? ({ time: actualTrip.TripStart, type: "actual" })
                          : !legState.isHistoricalMatch &&
                              legState.originArrivePrediction != null
                            ? ({
                                time: legState.originArrivePrediction,
                                type: "estimated",
                              })
                            : null
                      }
                    />
                  )}
                </TimelineMarker>

                <TimelineBarAtDock
                  startTimeMs={originDockStartMs}
                  endTimeMs={originDockEndMs}
                  status={originDockStatus}
                  isArrived={originDockStatus === "Completed"}
                  isHeld={false}
                  predictionEndTimeMs={
                    isActive && timeline.activePhase === "AtDock"
                      ? legState.departurePrediction?.getTime()
                      : undefined
                  }
                  vesselName={vesselLocation?.VesselName}
                  atDockAbbrev={
                    isActive && timeline.activePhase === "AtDock" && !isHeld
                      ? segment.DepartingTerminalAbbrev
                      : undefined
                  }
                  showIndicator={
                    isActive && timeline.activePhase === "AtDock" && !isHeld
                  }
                />
              </>
            )}

            <TimelineMarker
              size={TIMELINE_CIRCLE_SIZE}
              className={TIMELINE_MARKER_CLASS}
              zIndex={10}
            >
              {() => (
                <TimelineMarkerlLabel
                  LabelText={`${legState.departInPast ? "Left" : "Depart"} ${segment.DepartingTerminalAbbrev}`}
                  TimeOne={
                    { time: segment.DepartingTime, type: "scheduled" }
                  }
                  TimeTwo={
                    legState.isHistoricalMatch &&
                    (actualTrip?.LeftDock ?? legState.departurePrediction) !=
                      null ? (
                      {
                        time:
                          actualTrip?.LeftDock ??
                          legState.departurePrediction ??
                          segment.DepartingTime,
                        type:
                          actualTrip?.LeftDock != null ? "actual" : "estimated",
                      }
                    ) : !legState.isHistoricalMatch &&
                      legState.departNextPrediction != null ? (
                      { time: legState.departNextPrediction, type: "estimated" }
                    ) : null
                  }
                />
              )}
            </TimelineMarker>

            <TimelineBarAtSea
              startTimeMs={atSeaStartMs}
              endTimeMs={atSeaEndMs}
              status={atSeaStatus}
              isArrived={isHeld || atSeaStatus === "Completed"}
              isHeld={isHeld}
              predictionEndTimeMs={
                isActive &&
                timeline.activePhase === "AtSea" &&
                legState.arrivalPrediction != null
                  ? legState.arrivalPrediction.getTime()
                  : undefined
              }
              departingDistance={vesselLocation?.DepartingDistance}
              arrivingDistance={vesselLocation?.ArrivingDistance}
              vesselName={vesselLocation?.VesselName}
              animate={isActive && timeline.activePhase === "AtSea" && !isHeld}
              speed={vesselLocation?.Speed}
              showIndicator={
                isActive && (timeline.activePhase === "AtSea" || isHeld)
              }
            />

            <TimelineMarker
              size={TIMELINE_CIRCLE_SIZE}
              className={TIMELINE_MARKER_CLASS}
              zIndex={10}
            >
              {() => (
                <TimelineMarkerlLabel
                  LabelText={`${legState.destArriveInPast ? "Arrived" : "Arrive"} ${segment.DisplayArrivingTerminalAbbrev ?? segment.ArrivingTerminalAbbrev}`}
                  TimeOne={
                    segment.SchedArriveNext !== undefined
                      ? ({
                          time: segment.SchedArriveNext,
                          type: "scheduled",
                        })
                      : null
                  }
                  TimeTwo={
                    legState.isHistoricalMatch &&
                    (actualTrip?.TripEnd ?? legState.arrivalPrediction) !=
                      null ? (
                      {
                        time:
                          actualTrip?.TripEnd ??
                          legState.arrivalPrediction ??
                          segment.SchedArriveNext,
                        type:
                          actualTrip?.TripEnd != null ? "actual" : "estimated",
                      }
                    ) : null
                  }
                />
              )}
            </TimelineMarker>

            {showNextDockBlock && (
              <TimelineBarAtDock
                startTimeMs={nextDockStartMs}
                endTimeMs={nextDockEndMs}
                status={legStatus === "Completed" ? "Completed" : "Pending"}
                isArrived={legStatus === "Completed"}
                predictionEndTimeMs={
                  isActive &&
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
// Internal helpers
// ============================================================================

type SegmentLegDerivedStateInline = {
  isHistoricalMatch: boolean;
  showOriginActualTime: boolean;
  originArrivePrediction: Date | undefined;
  departurePrediction: Date | undefined;
  arrivalPrediction: Date | undefined;
  departNextPrediction: Date | undefined;
  originArriveInPast: boolean;
  departInPast: boolean;
  destArriveInPast: boolean;
};

/**
 * Computes display-oriented derived state for a scheduled segment leg.
 * Inlined from the former `utils/segmentLegDerivedState.ts` to keep rendering flat.
 *
 * @param segment - Scheduled segment being rendered
 * @param vesselLocation - Real-time vessel location (optional)
 * @param actualTrip - Overlay trip matched by segment Key (optional)
 * @param prevActualTrip - Overlay trip for previous segment (optional)
 * @param predictionTrip - Inbound trip used for first-segment predictions (optional)
 * @param nowMs - Time base for past-tense checks (prefer VesselLocation.TimeStamp)
 * @returns Derived state used by the timeline markers/bars
 */
const getSegmentLegDerivedStateInline = (params: {
  segment: SegmentTuple["segment"];
  vesselLocation: VesselLocation | null;
  actualTrip: VesselTrip | undefined;
  prevActualTrip: VesselTrip | undefined;
  predictionTrip: VesselTrip | undefined;
  nowMs: number;
}): SegmentLegDerivedStateInline => {
  const {
    segment,
    vesselLocation,
    actualTrip,
    prevActualTrip,
    predictionTrip,
    nowMs,
  } = params;

  const isHistoricalMatch = actualTrip !== undefined;

  const departurePrediction = getBestDepartureTime(
    vesselLocation ?? undefined,
    actualTrip
  );
  const arrivalPrediction = getBestArrivalTime(
    vesselLocation ?? undefined,
    actualTrip
  );
  const departNextPrediction = getBestNextDepartureTime(
    prevActualTrip ?? predictionTrip
  );

  const originArrivePrediction =
    !isHistoricalMatch &&
    vesselLocation &&
    !vesselLocation.AtDock &&
    predictionTrip &&
    vesselLocation.ArrivingTerminalAbbrev === segment.DepartingTerminalAbbrev
      ? getPredictedArriveNextTime(predictionTrip, vesselLocation)
      : undefined;

  const showOriginActualTime = !!(
    isHistoricalMatch &&
    actualTrip?.TripStart &&
    (!segment.SailingDay ||
      getSailingDay(actualTrip.TripStart) === segment.SailingDay)
  );

  const originArriveInPast =
    (isHistoricalMatch && !!actualTrip?.LeftDock) ||
    (segment.SchedArriveCurr != null &&
      segment.SchedArriveCurr.getTime() < nowMs);
  const departInPast =
    (isHistoricalMatch && !!actualTrip?.LeftDock) ||
    segment.DepartingTime.getTime() < nowMs;
  const destArriveInPast =
    (isHistoricalMatch && !!actualTrip?.TripEnd) ||
    (segment.SchedArriveNext != null &&
      segment.SchedArriveNext.getTime() < nowMs);

  return {
    isHistoricalMatch,
    showOriginActualTime,
    originArrivePrediction,
    departurePrediction,
    arrivalPrediction,
    departNextPrediction,
    originArriveInPast,
    departInPast,
    destArriveInPast,
  };
};
