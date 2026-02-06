/**
 * TimelineSegmentLeg component for displaying a single leg of the journey.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { TIMELINE_MARKER_CLASS } from "./config";
import type { TimelineActivePhase } from "./resolveTimeline";
import TimelineBarAtDock from "./TimelineBarAtDock";
import TimelineBarAtSea from "./TimelineBarAtSea";
import TimelineDisplayTime from "./TimelineDisplayTime";
import TimelineMarker from "./TimelineMarker";
import type { Segment, TimelineSegmentStatus } from "./types";
import { getSegmentLegDerivedState } from "./utils";

type TimelineSegmentLegProps = {
  segment: Segment;
  vesselLocation: VesselLocation;
  actualTrip?: VesselTrip;
  prevActualTrip?: VesselTrip;
  nextActualTrip?: VesselTrip;
  circleSize: number;
  isFirst?: boolean;
  isLast?: boolean;
  skipAtDock?: boolean;
  legStatus: TimelineSegmentStatus;
  activeKey: string | null;
  activePhase: TimelineActivePhase;
};

/**
 * Displays a single leg of the journey, including the progress bar and arrival marker.
 * If isFirst is true, it also handles the origin arrival and at-dock period.
 * If skipAtDock is true, it skips the origin arrival and at-dock period.
 */
export const TimelineSegmentLeg = ({
  segment,
  vesselLocation,
  actualTrip,
  prevActualTrip,
  nextActualTrip,
  circleSize,
  isFirst = false,
  isLast = false,
  skipAtDock = false,
  legStatus,
  activeKey,
  activePhase,
}: TimelineSegmentLegProps) => {
  const legState = getSegmentLegDerivedState(
    segment,
    vesselLocation,
    actualTrip,
    prevActualTrip,
    vesselLocation.TimeStamp.getTime()
  );

  const isActive = activeKey != null && activeKey === segment.Key;
  const isHeld = isActive && !!actualTrip?.TripEnd;

  const originDockStatus: TimelineSegmentStatus =
    legStatus === "Completed"
      ? "Completed"
      : isActive && activePhase === "AtDock" && !isHeld
        ? "InProgress"
        : isActive
          ? "Completed"
          : "Pending";

  const atSeaStatus: TimelineSegmentStatus =
    legStatus === "Completed"
      ? "Completed"
      : isHeld
        ? "Completed"
        : isActive && activePhase === "AtSea"
          ? "InProgress"
          : isActive
            ? "Pending"
            : "Pending";

  return (
    <>
      {isFirst && !skipAtDock && (
        <>
          <TimelineMarker
            size={circleSize}
            className={TIMELINE_MARKER_CLASS}
            zIndex={10}
          >
            <View className="items-center">
              <Text className="text-xs text-muted-foreground">
                {`${legState.originArriveInPast ? "Arrived" : "Arrive"} ${segment.DepartingTerminalAbbrev}`}
              </Text>
              {segment.SchedArriveCurr !== undefined ? (
                <TimelineDisplayTime
                  time={segment.SchedArriveCurr}
                  type="scheduled"
                  bold
                />
              ) : (
                <Text className="text-xs text-muted-foreground">--:--</Text>
              )}
              {legState.showOriginActualTime && actualTrip?.TripStart && (
                <TimelineDisplayTime
                  time={actualTrip.TripStart}
                  type="actual"
                  bold={false}
                />
              )}
            </View>
          </TimelineMarker>

          <TimelineBarAtDock
            state={{
              startTimeMs:
                (legState.isHistoricalMatch &&
                  actualTrip?.TripStart?.getTime()) ||
                segment.SchedArriveCurr?.getTime(),
              endTimeMs:
                (legState.isHistoricalMatch &&
                  actualTrip?.LeftDock?.getTime()) ||
                segment.DepartingTime.getTime(),
              status: originDockStatus,
              isArrived: originDockStatus === "Completed",
              isHeld: false,
              predictionEndTimeMs:
                isActive && activePhase === "AtDock"
                  ? legState.departurePrediction?.getTime()
                  : undefined,
            }}
            vesselName={vesselLocation.VesselName}
            atDockAbbrev={
              isActive && activePhase === "AtDock" && !isHeld
                ? segment.DepartingTerminalAbbrev
                : undefined
            }
            showIndicator={isActive && activePhase === "AtDock" && !isHeld}
          />
        </>
      )}

      <TimelineMarker
        size={circleSize}
        className={TIMELINE_MARKER_CLASS}
        zIndex={10}
      >
        <View className="items-center">
          <Text className="text-xs text-muted-foreground">
            {`${legState.departInPast ? "Left" : "Depart"} ${segment.DepartingTerminalAbbrev}`}
          </Text>
          <TimelineDisplayTime
            time={segment.DepartingTime}
            type="scheduled"
            bold
          />
          {legState.isHistoricalMatch &&
          (actualTrip?.LeftDock || legState.departurePrediction) ? (
            <TimelineDisplayTime
              time={actualTrip?.LeftDock ?? legState.departurePrediction}
              type={actualTrip?.LeftDock ? "actual" : "estimated"}
              bold={false}
            />
          ) : null}
          {!legState.isHistoricalMatch && legState.departNextPrediction && (
            <TimelineDisplayTime
              time={legState.departNextPrediction}
              type="estimated"
              bold={false}
            />
          )}
        </View>
      </TimelineMarker>

      <TimelineBarAtSea
        state={{
          startTimeMs:
            (legState.isHistoricalMatch &&
              (actualTrip?.LeftDock?.getTime() ||
                actualTrip?.TripStart?.getTime())) ||
            segment.DepartingTime.getTime(),
          endTimeMs:
            (legState.isHistoricalMatch &&
              (actualTrip?.TripEnd?.getTime() ||
                legState.arrivalPrediction?.getTime())) ||
            segment.SchedArriveNext?.getTime(),
          status: atSeaStatus,
          isArrived: isHeld || atSeaStatus === "Completed",
          isHeld,
          predictionEndTimeMs:
            isActive && activePhase === "AtSea" && legState.arrivalPrediction
              ? legState.arrivalPrediction.getTime()
              : undefined,
        }}
        departingDistance={vesselLocation.DepartingDistance}
        arrivingDistance={vesselLocation.ArrivingDistance}
        vesselName={vesselLocation.VesselName}
        animate={isActive && activePhase === "AtSea" && !isHeld}
        speed={vesselLocation.Speed}
        showIndicator={isActive && (activePhase === "AtSea" || isHeld)}
      />

      <TimelineMarker
        size={circleSize}
        className={TIMELINE_MARKER_CLASS}
        zIndex={10}
      >
        <View className="items-center">
          <Text className="text-xs text-muted-foreground">
            {`${legState.destArriveInPast ? "Arrived" : "Arrive"} ${segment.DisplayArrivingTerminalAbbrev || segment.ArrivingTerminalAbbrev}`}
          </Text>
          {segment.SchedArriveNext !== undefined ? (
            <TimelineDisplayTime
              time={segment.SchedArriveNext}
              type="scheduled"
              bold
            />
          ) : (
            <Text className="text-xs text-muted-foreground">--:--</Text>
          )}
          {legState.isHistoricalMatch &&
          (actualTrip?.TripEnd || legState.arrivalPrediction) ? (
            <TimelineDisplayTime
              time={actualTrip?.TripEnd ?? legState.arrivalPrediction}
              type={actualTrip?.TripEnd ? "actual" : "estimated"}
              bold={false}
            />
          ) : null}
        </View>
      </TimelineMarker>

      {!isLast && segment.NextDepartingTime && (
        <TimelineBarAtDock
          state={{
            startTimeMs:
              (legState.isHistoricalMatch && actualTrip?.TripEnd?.getTime()) ||
              segment.SchedArriveNext?.getTime(),
            endTimeMs:
              (legState.isHistoricalMatch &&
                nextActualTrip?.TripStart?.getTime()) ||
              segment.NextDepartingTime.getTime(),
            status: legStatus === "Completed" ? "Completed" : "Pending",
            isArrived: legStatus === "Completed",
            predictionEndTimeMs:
              isActive &&
              activePhase === "AtDock" &&
              actualTrip?.AtDockDepartNext
                ? actualTrip.AtDockDepartNext.PredTime.getTime()
                : undefined,
          }}
          vesselName={vesselLocation.VesselName}
        />
      )}
    </>
  );
};
