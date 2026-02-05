/**
 * TimelineSegmentLeg component for displaying a single leg of the journey.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { Text } from "@/components/ui";
import {
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineDisplayTime,
  TimelineMarker,
} from "../../Timeline";
import { getBestArrivalTime, getBestDepartureTime } from "../../Timeline/utils";
import type { Segment } from "../types";

type TimelineSegmentLegProps = {
  segment: Segment;
  vesselLocation: VesselLocation; // PRIMARY: real-time WSF data
  displayTrip?: VesselTrip; // SECONDARY: ML predictions, historical data
  vesselTripMap?: Map<string, VesselTrip>;
  circleSize: number;
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
  vesselLocation,
  displayTrip,
  vesselTripMap,
  circleSize,
  isFirst = false,
  isLast = false,
  skipAtDock = false,
}: TimelineSegmentLegProps) => {
  /**
   * Status calculation from VesselLocation (PRIMARY source)
   */
  const isAtOriginDock =
    vesselLocation?.AtDock &&
    vesselLocation.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev;

  const isInTransitForSegment =
    !vesselLocation?.AtDock &&
    vesselLocation.DepartingTerminalAbbrev ===
      segment.DepartingTerminalAbbrev &&
    vesselLocation.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev;

  const isCorrectTrip =
    vesselLocation.DepartingTerminalAbbrev ===
      segment.DepartingTerminalAbbrev &&
    vesselLocation.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev &&
    displayTrip &&
    displayTrip.ScheduledDeparture &&
    displayTrip.ScheduledDeparture.getTime() ===
      segment.DepartingTime.getTime();

  // For historical trips (completed earlier in the day), we match based on the segment's scheduled departure
  const isHistoricalMatch =
    displayTrip &&
    displayTrip.ScheduledDeparture &&
    displayTrip.ScheduledDeparture.getTime() ===
      segment.DepartingTime.getTime() &&
    displayTrip.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
    displayTrip.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev;

  /**
   * Prediction Selection Logic
   * Priority: WSF > ML > Scheduled
   *
   * When vessel is at-dock for correct trip: show departCurr, arriveNext, departNext
   * When vessel is at-sea for correct trip: show arriveNext, departNext
   * When vessel is incoming (heading to origin): show departNext only
   * When no match: show nothing
   */
  const departurePrediction = getBestDepartureTime(vesselLocation, displayTrip);

  const arrivalPrediction = getBestArrivalTime(vesselLocation, displayTrip);

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
              {isHistoricalMatch && displayTrip?.TripStart && (
                <TimelineDisplayTime
                  time={displayTrip.TripStart}
                  type="actual"
                  bold={false}
                />
              )}
            </View>
          </TimelineMarker>

          <TimelineBarAtDock
            startTimeMs={
              (isHistoricalMatch && displayTrip?.TripStart?.getTime()) ||
              segment.SchedArriveCurr?.getTime()
            }
            endTimeMs={
              (isHistoricalMatch && displayTrip?.LeftDock?.getTime()) ||
              segment.DepartingTime.getTime()
            }
            status={
              displayTrip
                ? displayTrip.LeftDock
                  ? "Completed"
                  : isAtOriginDock && isCorrectTrip
                    ? "InProgress"
                    : "Pending"
                : segment.DepartingTime.getTime() < Date.now()
                  ? "Completed"
                  : "Pending"
            }
            vesselName={vesselLocation.VesselName}
            atDockAbbrev={
              isAtOriginDock && isCorrectTrip
                ? segment.DepartingTerminalAbbrev
                : undefined
            }
            isArrived={
              (isHistoricalMatch && !!displayTrip.LeftDock) ||
              segment.DepartingTime.getTime() < Date.now()
            }
            isHeld={
              !!displayTrip &&
              !!displayTrip.TripEnd &&
              displayTrip.DepartingTerminalAbbrev ===
                segment.DepartingTerminalAbbrev &&
              isCorrectTrip
            }
            showIndicator={
              (isAtOriginDock && isCorrectTrip && !!displayTrip) ||
              (!!displayTrip &&
                !!displayTrip.TripEnd &&
                displayTrip.DepartingTerminalAbbrev ===
                  segment.DepartingTerminalAbbrev &&
                isCorrectTrip)
            }
            predictionEndTimeMs={
              // Show departCurr when at-dock for correct trip
              isAtOriginDock && isCorrectTrip
                ? departurePrediction?.getTime()
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
          {isHistoricalMatch &&
          (displayTrip?.LeftDock || departurePrediction) ? (
            <TimelineDisplayTime
              time={displayTrip?.LeftDock ?? departurePrediction}
              type={displayTrip?.LeftDock ? "actual" : "estimated"}
              bold={false}
            />
          ) : null}
        </View>
      </TimelineMarker>

      {/* At-Sea Progress Bar (Depart -> Arrive Next) */}
      <TimelineBarAtSea
        departingDistance={vesselLocation.DepartingDistance}
        arrivingDistance={vesselLocation.ArrivingDistance}
        startTimeMs={
          (isHistoricalMatch &&
            (displayTrip?.LeftDock?.getTime() ||
              displayTrip?.TripStart?.getTime())) ||
          segment.DepartingTime.getTime()
        }
        endTimeMs={
          (isHistoricalMatch &&
            (displayTrip?.TripEnd?.getTime() ||
              arrivalPrediction?.getTime())) ||
          segment.SchedArriveNext?.getTime()
        }
        status={
          displayTrip
            ? displayTrip.TripEnd
              ? "Completed"
              : isInTransitForSegment && isCorrectTrip
                ? "InProgress"
                : "Pending"
            : segment.SchedArriveNext &&
                segment.SchedArriveNext.getTime() < Date.now()
              ? "Completed"
              : "Pending"
        }
        vesselName={vesselLocation.VesselName}
        animate={
          isInTransitForSegment &&
          isCorrectTrip &&
          !!displayTrip &&
          !displayTrip.TripEnd
        }
        speed={vesselLocation.Speed}
        isArrived={
          (isHistoricalMatch && !!displayTrip.TripEnd) ||
          (segment.SchedArriveNext &&
            segment.SchedArriveNext.getTime() < Date.now())
        }
        isHeld={
          !!displayTrip &&
          !!displayTrip.TripEnd &&
          displayTrip.ArrivingTerminalAbbrev ===
            segment.ArrivingTerminalAbbrev &&
          isCorrectTrip
        }
        showIndicator={
          (isInTransitForSegment && isCorrectTrip && !!displayTrip) ||
          (!!displayTrip &&
            !!displayTrip.TripEnd &&
            displayTrip.ArrivingTerminalAbbrev ===
              segment.ArrivingTerminalAbbrev &&
            isCorrectTrip)
        }
        predictionEndTimeMs={
          // Show arriveNext when at-sea for correct trip
          isInTransitForSegment && isCorrectTrip && arrivalPrediction
            ? arrivalPrediction.getTime()
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
          {isHistoricalMatch && (displayTrip?.TripEnd || arrivalPrediction) ? (
            <TimelineDisplayTime
              time={displayTrip?.TripEnd ?? arrivalPrediction}
              type={displayTrip?.TripEnd ? "actual" : "estimated"}
              bold={false}
            />
          ) : null}
        </View>
      </TimelineMarker>

      {/* Inter-segment At-Dock Progress Bar (Arrive -> Depart Next) */}
      {!isLast && segment.NextDepartingTime && (
        <TimelineBarAtDock
          startTimeMs={
            (isHistoricalMatch && displayTrip?.TripEnd?.getTime()) ||
            segment.SchedArriveNext?.getTime()
          }
          endTimeMs={
            (isHistoricalMatch &&
              vesselTripMap
                ?.get(segment.Key + "_next")
                ?.TripStart?.getTime()) ||
            segment.NextDepartingTime.getTime()
          }
          status={
            segment.NextDepartingTime.getTime() < Date.now()
              ? "Completed"
              : "Pending"
          }
          vesselName={vesselLocation.VesselName}
          isArrived={segment.NextDepartingTime.getTime() < Date.now()}
          predictionEndTimeMs={
            // Show departNext when at-dock for correct trip
            isAtOriginDock && isCorrectTrip && displayTrip?.AtDockDepartNext
              ? displayTrip.AtDockDepartNext.PredTime.getTime()
              : undefined
          }
        />
      )}
    </>
  );
};
