/**
 * TimelineSegmentLeg component for displaying a single leg of the journey.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { Text } from "@/components/ui";
import {
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineDisplayTime,
  TimelineMarker,
} from "../../Timeline";
import type { Segment } from "../types";
import { matchVesselTrip } from "../utils/matchVesselTrip";

type TimelineSegmentLegProps = {
  segment: Segment;
  vesselAbbrev: string;
  vesselName: string;
  vesselSpeed: number;
  circleSize: number;
  vesselTripMap: Map<string, VesselTrip>;
  currentVessel?: {
    DepartingDistance?: number;
    ArrivingDistance?: number;
  };
  isFirst?: boolean;
  isLast?: boolean;
  skipAtDock?: boolean;
};

/**
 * Displays a single leg of the journey, including the progress bar and arrival marker.
 * If isFirst is true, it also handles the origin arrival and at-dock period.
 * If skipAtDock is true, it skips the origin arrival and at-dock period.
 */
export const TimelineSegmentLeg = ({
  segment,
  vesselAbbrev,
  vesselName,
  vesselSpeed,
  circleSize,
  vesselTripMap,
  currentVessel,
  isFirst = false,
  isLast = false,
  skipAtDock = false,
}: TimelineSegmentLegProps) => {
  const {
    displayTrip,
    isIncoming,
    isAtOriginDock,
    isInTransitForSegment,
    isCorrectTrip,
  } = matchVesselTrip(
    segment,
    vesselTripMap
  );

  /**
   * Prediction Selection Logic
   * 
   * When vessel is at-dock for correct trip: show departCurr, arriveNext, departNext
   * When vessel is at-sea for correct trip: show arriveNext, departNext
   * When vessel is incoming (heading to origin): show departNext only
   * When no match: show nothing
   */
  const departurePrediction =
    isCorrectTrip && !isIncoming
      ? displayTrip
        ? displayTrip.predictions.departCurr
        : null
      : isIncoming && !isAtOriginDock
        ? displayTrip
          ? displayTrip.predictions.departNext
          : null
        : null;

  const arrivalPrediction =
    !isIncoming && isCorrectTrip
      ? displayTrip
        ? displayTrip.predictions.arriveNext
        : null
      : null;

  return (
    <>
      {/* Absolute Origin Logic (Arrive Origin -> At-Dock Origin) */}
      {isFirst && !skipAtDock && (
        <>
          <TimelineMarker
            size={circleSize}
            className="bg-white border border-blue-500"
            zIndex={10}
          >
            <View className="items-center">
              <Text className="text-xs text-muted-foreground">
                {`Arrive ${segment.DepartingTerminalAbbrev}`}
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
            </View>
          </TimelineMarker>

          <TimelineBarAtDock
            startTimeMs={segment.SchedArriveCurr?.getTime()}
            endTimeMs={segment.DepartingTime.getTime()}
            status={
              displayTrip
                ? displayTrip.LeftDock
                  ? "Completed"
                  : isAtOriginDock && isCorrectTrip
                    ? "InProgress"
                    : "Pending"
                : "Pending"
            }
            vesselName={vesselName}
            atDockAbbrev={
              isAtOriginDock && isCorrectTrip
                ? segment.DepartingTerminalAbbrev
                : undefined
            }
            predictionEndTimeMs={
              // Show departCurr when at-dock for correct trip
              isAtOriginDock && isCorrectTrip
                ? departurePrediction?.time.getTime()
                : undefined
            }
          />
        </>
      )}

      {/* Departure Marker for this leg */}
      <TimelineMarker
        size={circleSize}
        className="bg-white border border-blue-500"
        zIndex={10}
      >
        <View className="items-center">
          <Text className="text-xs text-muted-foreground">
            {`Depart ${segment.DepartingTerminalAbbrev}`}
          </Text>
          <TimelineDisplayTime
            time={segment.DepartingTime}
            type="scheduled"
            bold
          />
          {departurePrediction && (
            <TimelineDisplayTime
              time={departurePrediction.time}
              type={
                departurePrediction.source === "ml" ? "estimated" : "actual"
              }
              bold={false}
            />
          )}
        </View>
      </TimelineMarker>

      {/* At-Sea Progress Bar (Depart -> Arrive Next) */}
      <TimelineBarAtSea
        departingDistance={currentVessel?.DepartingDistance}
        arrivingDistance={currentVessel?.ArrivingDistance}
        startTimeMs={segment.DepartingTime.getTime()}
        endTimeMs={segment.SchedArriveNext?.getTime()}
        status={
          displayTrip
            ? displayTrip.TripEnd
              ? "Completed"
              : isInTransitForSegment && isCorrectTrip
                ? "InProgress"
                : "Pending"
            : "Pending"
        }
        vesselName={vesselName}
        animate={isInTransitForSegment && isCorrectTrip && !!displayTrip && !displayTrip.TripEnd}
        speed={vesselSpeed}
        isArrived={
          !!displayTrip &&
          !!displayTrip.TripEnd &&
          displayTrip.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev
        }
        predictionEndTimeMs={
          // Show arriveNext when at-sea for correct trip
          isInTransitForSegment && isCorrectTrip && arrivalPrediction
            ? arrivalPrediction.time.getTime()
            : undefined
        }
      />

      {/* Arrival Marker & Label for this leg */}
      <TimelineMarker
        size={circleSize}
        className="bg-white border border-blue-500"
        zIndex={10}
      >
        <View className="items-center">
          <Text className="text-xs text-muted-foreground">
            {`Arrive ${segment.DisplayArrivingTerminalAbbrev || segment.ArrivingTerminalAbbrev}`}
          </Text>
          {/* Scheduled arrival time is bold and on the first line */}
          {segment.SchedArriveNext !== undefined ? (
            <TimelineDisplayTime
              time={segment.SchedArriveNext}
              type="scheduled"
              bold
            />
          ) : (
            <Text className="text-xs text-muted-foreground">--:--</Text>
          )}
          {/* Actual or Estimated arrival time */}
          {arrivalPrediction && (
            <TimelineDisplayTime
              time={arrivalPrediction.time}
              type={arrivalPrediction.source === "ml" ? "estimated" : "actual"}
              bold={false}
            />
          )}
        </View>
      </TimelineMarker>

      {/* Inter-segment At-Dock Progress Bar (Arrive -> Depart Next) */}
      {!isLast && segment.NextDepartingTime && (
        <TimelineBarAtDock
          startTimeMs={segment.SchedArriveNext?.getTime()}
          endTimeMs={segment.NextDepartingTime.getTime()}
          status="Pending"
          vesselName={vesselName}
        predictionEndTimeMs={
          // Show departNext when at-dock for correct trip
          isAtOriginDock && isCorrectTrip && displayTrip?.predictions.departNext?.time
            ? displayTrip.predictions.departNext.time.getTime()
            : undefined
        }
        />
      )}
    </>
  );
};
