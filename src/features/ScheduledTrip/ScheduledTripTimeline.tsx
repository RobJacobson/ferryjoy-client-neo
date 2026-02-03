/**
 * ScheduledTripTimeline component for displaying a sequence of scheduled trip segments.
 * Visualizes the journey from departure terminal to final destination, including intermediate stops.
 */

import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { getVesselName } from "@/domain/vesselAbbreviations";
import {
  TimelineBarTime,
  TimelineDisplayTime,
  TimelineMarker,
} from "../Timeline";

/**
 * Segment type representing a single leg of a journey.
 */
type Segment = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DisplayArrivingTerminalAbbrev?: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SchedArriveNext?: number;
  SchedArriveCurr?: number;
  Key: string;
};

type ScheduledTripTimelineProps = {
  /**
   * Array of segments forming the complete journey.
   */
  segments: Segment[];
};

/**
 * Displays a multi-segment timeline for scheduled ferry trips.
 * Shows scheduled departure times and arrival times, with actual times overlaid if a matching
 * active or recently completed trip is found.
 *
 * @param segments - Array of trip segments to display
 * @returns A View component with a sequence of markers and progress bars
 */
export const ScheduledTripTimeline = ({
  segments,
}: ScheduledTripTimelineProps) => {
  const { dailyVesselTrips } = useConvexVesselTrips();
  const circleSize = 20;

  // Get the vessel abbreviation from the first segment to show the vessel name on progress bars
  const vesselAbbrev = segments[0]?.Key.split("-")[0] || "";
  const vesselName = getVesselName(vesselAbbrev);

  if (segments.length === 0) return null;

  return (
    <View className="relative flex-row items-center justify-between w-full overflow-visible px-4 py-8">
      {/* Origin Arrival Marker & At-Dock Bar */}
      {segments[0] && (
        <>
          <TimelineMarker
            size={circleSize}
            className="bg-white border border-blue-500"
            zIndex={10}
          >
            <View className="items-center">
              <Text className="text-xs text-muted-foreground">
                {`Arrive ${segments[0].DepartingTerminalAbbrev}`}
              </Text>
              {segments[0].SchedArriveCurr !== undefined ? (
                <TimelineDisplayTime
                  time={new Date(segments[0].SchedArriveCurr)}
                  type="scheduled"
                  bold
                />
              ) : (
                <Text className="text-xs text-muted-foreground">--:--</Text>
              )}
              {(() => {
                // Match actual trip for the first segment to show actual arrival at origin
                // We match based on Vessel, Departing Terminal, and Departing Time for better reliability
                // than the composite Key, which might have different destination abbreviations.
                const firstActual = dailyVesselTrips.find(
                  (t) =>
                    t.VesselAbbrev === segments[0].VesselAbbrev &&
                    t.DepartingTerminalAbbrev ===
                      segments[0].DepartingTerminalAbbrev &&
                    (t.ScheduledDeparture?.getTime() ===
                      segments[0].DepartingTime ||
                      t.ScheduledTrip?.DepartingTime.getTime() ===
                        segments[0].DepartingTime)
                );
                return (
                  firstActual?.TripStart && (
                    <TimelineDisplayTime
                      time={firstActual.TripStart}
                      type="actual"
                    />
                  )
                );
              })()}
            </View>
          </TimelineMarker>

          {/* At-Dock Progress Bar for Origin (Arrive -> Depart) */}
          <TimelineBarTime
            startTimeMs={segments[0].SchedArriveCurr}
            endTimeMs={segments[0].DepartingTime}
            status={(() => {
              const firstActual = dailyVesselTrips.find(
                (t) =>
                  t.VesselAbbrev === segments[0].VesselAbbrev &&
                  t.DepartingTerminalAbbrev ===
                    segments[0].DepartingTerminalAbbrev &&
                  (t.ScheduledDeparture?.getTime() ===
                    segments[0].DepartingTime ||
                    t.ScheduledTrip?.DepartingTime.getTime() ===
                      segments[0].DepartingTime)
              );
              return firstActual
                ? firstActual.LeftDock
                  ? "Completed"
                  : "InProgress"
                : "Pending";
            })()}
            vesselName={vesselName}
            circleSize={circleSize}
            atDockAbbrev={segments[0].DepartingTerminalAbbrev}
          />
        </>
      )}

      {/* Origin Departure Marker */}
      <TimelineMarker
        size={circleSize}
        className="bg-white border border-blue-500"
        zIndex={10}
      >
        <View className="items-center">
          <Text className="text-xs text-muted-foreground">
            {`Depart ${segments[0].DepartingTerminalAbbrev}`}
          </Text>
          <TimelineDisplayTime
            time={new Date(segments[0].DepartingTime)}
            type="scheduled"
            bold
          />
          {(() => {
            const firstActual = dailyVesselTrips.find(
              (t) =>
                t.VesselAbbrev === segments[0].VesselAbbrev &&
                t.DepartingTerminalAbbrev ===
                  segments[0].DepartingTerminalAbbrev &&
                (t.ScheduledDeparture?.getTime() ===
                  segments[0].DepartingTime ||
                  t.ScheduledTrip?.DepartingTime.getTime() ===
                    segments[0].DepartingTime)
            );
            return (
              firstActual?.LeftDock && (
                <TimelineDisplayTime
                  time={firstActual.LeftDock}
                  type="actual"
                />
              )
            );
          })()}
        </View>
      </TimelineMarker>

      {segments.map((segment, index) => {
        // For actual data matching, we need to be careful with multi-segment trips.
        // The scheduled trip Key includes the final destination (e.g., ANA-FRH),
        // but the actual vessel trip might be recorded with the immediate stop (e.g., ANA-LOP).
        // We match based on Vessel, Departing Terminal, and Departing Time for better reliability.
        const actualTrip = dailyVesselTrips.find(
          (t) =>
            t.VesselAbbrev === segment.VesselAbbrev &&
            t.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
            (t.ScheduledDeparture?.getTime() === segment.DepartingTime ||
              t.ScheduledTrip?.DepartingTime.getTime() ===
                segment.DepartingTime)
        );

        // However, for intermediate stops, the arrival at B is ALSO the TripStart
        // of the NEXT segment (B -> C). We should check both to be thorough.
        const nextSegment = segments[index + 1];
        const nextActualTrip = nextSegment
          ? dailyVesselTrips.find(
              (t) =>
                t.VesselAbbrev === nextSegment.VesselAbbrev &&
                t.DepartingTerminalAbbrev ===
                  nextSegment.DepartingTerminalAbbrev &&
                (t.ScheduledDeparture?.getTime() ===
                  nextSegment.DepartingTime ||
                  t.ScheduledTrip?.DepartingTime.getTime() ===
                    nextSegment.DepartingTime)
            )
          : null;

        const actualArrivalTime =
          actualTrip?.TripEnd || nextActualTrip?.TripStart;

        return (
          <React.Fragment key={segment.Key}>
            {/* At-Sea Progress Bar (Depart -> Arrive Next) */}
            <TimelineBarTime
              startTimeMs={segment.DepartingTime}
              endTimeMs={segment.SchedArriveNext}
              status={
                actualTrip
                  ? actualTrip.TripEnd
                    ? "Completed"
                    : !actualTrip.AtDock
                      ? "InProgress"
                      : "Pending"
                  : "Pending"
              }
              vesselName={vesselName}
              circleSize={circleSize}
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
                    time={new Date(segment.SchedArriveNext)}
                    type="scheduled"
                    bold
                  />
                ) : (
                  <Text className="text-xs text-muted-foreground">--:--</Text>
                )}
                {/* Actual arrival time is non-bold and below it if available */}
                {actualArrivalTime && (
                  <TimelineDisplayTime time={actualArrivalTime} type="actual" />
                )}
              </View>
            </TimelineMarker>
          </React.Fragment>
        );
      })}
    </View>
  );
};
