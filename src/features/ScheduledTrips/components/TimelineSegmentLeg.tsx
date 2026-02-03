/**
 * TimelineSegmentLeg component for displaying a single leg of the journey.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { Text } from "@/components/ui";
import {
  TimelineBarDistance,
  TimelineBarTime,
  TimelineDisplayTime,
  TimelineMarker,
} from "../../Timeline";
import type { Segment } from "../types";
import { matchVesselTrip } from "../utils/matchVesselTrip";
import { OriginArrivalIndicator } from "./OriginArrivalIndicator";

type TimelineSegmentLegProps = {
  segment: Segment;
  vesselAbbrev: string;
  vesselName: string;
  vesselSpeed: number;
  circleSize: number;
  vesselTripMap: Map<string, VesselTrip>;
  activeVesselTripMap: Map<string, VesselTrip>;
  vesselTripsByVessel: Map<string, VesselTrip[]>;
  tripsByTerminalAndTime: Map<string, VesselTrip>;
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
  vesselTripsByVessel,
  tripsByTerminalAndTime,
  currentVessel,
  isFirst = false,
  isLast = false,
  skipAtDock = false,
}: TimelineSegmentLegProps) => {
  const {
    displayTrip,
    isIncoming,
    isAtDepartingTerminal,
    isAtSeaForSegment,
    isActuallyAtTerminal,
  } = matchVesselTrip(
    segment,
    vesselAbbrev,
    vesselTripMap,
    vesselTripsByVessel,
    tripsByTerminalAndTime
  );

  // For arrival predictions, if this is an incoming vessel, we want its arriveNext prediction.
  // If it's the active trip, we also want arriveNext.
  // BUT: We only show arrivalPrediction if displayTrip is NOT an incoming vessel,
  // OR if it's an incoming vessel that is NOT the same as the vesselAbbrev for this schedule.
  // This prevents the "vessel heading to origin" prediction from appearing at the destination.
  const isIncomingForArrival =
    isIncoming ||
    (!!displayTrip &&
      !displayTrip.AtDock &&
      displayTrip.ArrivingTerminalAbbrev === segment.DepartingTerminalAbbrev);

  const arrivalPrediction =
    isIncomingForArrival &&
    displayTrip &&
    displayTrip.VesselAbbrev === vesselAbbrev
      ? null
      : displayTrip
        ? displayTrip.predictions.arriveNext
        : null;

  const departurePrediction =
    isIncoming && !isAtDepartingTerminal
      ? displayTrip
        ? displayTrip.predictions.departNext
        : null
      : displayTrip
        ? displayTrip.predictions.departCurr
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
              <OriginArrivalIndicator
                vesselAbbrev={vesselAbbrev}
                firstSegment={segment}
                vesselTripsByVessel={vesselTripsByVessel}
              />
            </View>
          </TimelineMarker>

          <TimelineBarTime
            startTimeMs={segment.SchedArriveCurr?.getTime()}
            endTimeMs={segment.DepartingTime.getTime()}
            status={
              displayTrip
                ? displayTrip.LeftDock
                  ? "Completed"
                  : isAtDepartingTerminal && isActuallyAtTerminal
                    ? "InProgress"
                    : "Pending"
                : "Pending"
            }
            vesselName={vesselName}
            circleSize={circleSize}
            atDockAbbrev={
              isAtDepartingTerminal && isActuallyAtTerminal
                ? segment.DepartingTerminalAbbrev
                : undefined
            }
            predictionEndTimeMs={departurePrediction?.time.getTime()}
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
      <TimelineBarDistance
        departingDistance={currentVessel?.DepartingDistance}
        arrivingDistance={currentVessel?.ArrivingDistance}
        startTimeMs={segment.DepartingTime.getTime()}
        endTimeMs={segment.SchedArriveNext?.getTime()}
        status={
          displayTrip
            ? displayTrip.TripEnd
              ? "Completed"
              : isAtSeaForSegment
                ? "InProgress"
                : "Pending"
            : "Pending"
        }
        vesselName={vesselName}
        animate={isAtSeaForSegment && !!displayTrip && !displayTrip.TripEnd}
        speed={vesselSpeed}
        circleSize={circleSize}
        isArrived={
          !!displayTrip &&
          !!displayTrip.TripEnd &&
          displayTrip.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev
        }
        predictionEndTimeMs={arrivalPrediction?.time.getTime()}
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
        <TimelineBarTime
          startTimeMs={segment.SchedArriveNext?.getTime()}
          endTimeMs={segment.NextDepartingTime.getTime()}
          status="Pending" // This would need more complex logic to be InProgress
          vesselName={vesselName}
          circleSize={circleSize}
        />
      )}
    </>
  );
};
