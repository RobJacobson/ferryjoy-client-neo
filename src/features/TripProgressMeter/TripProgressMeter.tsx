/**
 * TripProgressMeter component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import TripProgressBar from "./shared/TripProgressBar";
import TripProgressLabel from "./shared/TripProgressLabel";

type TripProgressMeterProps = {
  /**
   * VesselTrip object containing trip data with actual, predicted, and scheduled times.
   */
  trip: VesselTrip;
  /**
   * Optional className for styling the container.
   */
  className?: string;
};

/**
 * Displays vessel trip progress through two sequential time segments with intelligent time selection and dynamic width allocation.
 *
 * The meter visualizes a ferry trip as two distinct phases:
 * 1. First segment: Progress from arriving at terminal A to departing from A (docking/loading phase)
 * 2. Second segment: Progress from departing A to arriving at terminal B (at-sea transit phase)
 *
 * Time selection prioritizes actual times over predicted times over scheduled times for accuracy.
 * Width allocation dynamically distributes space between segments based on their relative durations,
 * using FlexBox flex-grow values with a minimum of 15% to ensure readability.
 * Each segment sizes itself based on its own time interval, so this component is
 * agnostic about sizing logic.
 *
 * The indicator is shown based on vessel state (AtDock property) rather than time-based progress,
 * allowing it to display correctly even when vessels are running late.
 *
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data
 * @param className - Optional className for styling the meter container
 * @returns A View component with two self-contained progress bars
 */
const TripProgressMeter = ({ trip, className }: TripProgressMeterProps) => {
  const arriveCurrTime = trip.TripStart;
  // const predictedDepartureTime = getPredictedDepartureTime(trip);
  const departCurrTime = getDepartureTime(trip);
  const predictedArrivalTime = getArrivalTime(trip);

  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible m-2 pr-4",
        className
      )}
    >
      {/* At Dock Start Label */}
      <TripProgressLabel>
        <ArriveCurrLabel trip={trip} />
      </TripProgressLabel>
      {/* At Dock Progress Bar */}
      <TripProgressBar
        startTimeMs={arriveCurrTime?.getTime()}
        endTimeMs={departCurrTime?.getTime()}
        status={trip.AtDock ? "InProgress" : "Completed"}
        vesselName={getVesselName(trip.VesselAbbrev)}
      />
      {/* Depart Curr Label */}
      <TripProgressLabel>
        <DepartCurrLabel trip={trip} />
      </TripProgressLabel>
      {/* At Sea Progress Bar */}
      <TripProgressBar
        startTimeMs={departCurrTime?.getTime()}
        endTimeMs={predictedArrivalTime?.getTime()}
        status={!trip.AtDock ? "InProgress" : "Pending"}
        vesselName={getVesselName(trip.VesselAbbrev)}
      />
      {/* Destination Arrive Label */}
      <TripProgressLabel>
        <DestinationArriveLabel trip={trip} />
      </TripProgressLabel>
    </View>
  );
};

/**
 * Renders the label for the left circle of the at-dock progress bar.
 * Displays the departing terminal name and actual arrival time.
 *
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with terminal text and arrival time
 */
const ArriveCurrLabel = ({ trip }: { trip: VesselTrip }) => (
  <View className="flex-col items-center justify-center mt-4">
    <LegendText bold={false}>
      {`Arrived ${trip.DepartingTerminalAbbrev}`}
    </LegendText>
    <DisplayTime time={trip.TripStart} suffix="" bold />
  </View>
);

/**
 * Renders the label for the right circle of the at-dock progress bar.
 * Conditionally displays predicted departure time (when at dock), actual departure time (when left),
 * and scheduled departure time (if available).
 *
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with departure status text and time information
 */
const DepartCurrLabel = ({ trip }: { trip: VesselTrip }) => (
  <View className="flex-col items-center justify-center mt-4">
    <LegendText bold={false}>
      {trip.AtDock ? "Leaves" : "Left"} {trip.DepartingTerminalAbbrev}
    </LegendText>
    {trip.AtDock && (
      <DisplayTime time={trip.AtDockDepartCurr?.PredTime} suffix="ETD" bold />
    )}
    {!trip.AtDock && <DisplayTime time={trip.LeftDock} bold />}
    <DisplayTime time={trip.ScheduledDeparture} suffix="Sched" />
  </View>
);

/**
 * Renders the label for the right circle of the at-sea progress bar.
 * Displays the arriving terminal name and predicted arrival time.
 *
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with terminal text and arrival time
 */
const DestinationArriveLabel = ({ trip }: { trip: VesselTrip }) => (
  <View className="flex-col items-center justify-center mt-4">
    <LegendText bold={false}>
      {`${trip.TripEnd ? "Arrived" : "Arrives"} ${trip.ArrivingTerminalAbbrev}`}
    </LegendText>
    {!trip.TripEnd && (
      <DisplayTime
        time={
          trip.Eta ||
          trip.AtSeaArriveNext?.PredTime ||
          trip.AtDockArriveNext?.PredTime
        }
        suffix="ETA"
        bold
      />
    )}
    {trip.TripEnd && <DisplayTime time={trip.TripEnd} bold />}
  </View>
);

/**
 * Displays a formatted time string with an optional suffix and bold styling.
 * Renders the time text and suffix in a horizontal row with centered alignment.
 *
 * @param time - Optional Date object containing the time to display
 * @param suffix - Optional string suffix to display after the time (e.g., "ETD", "ETA", "Sched")
 * @param bold - Optional boolean to apply bold styling to the time text (default false)
 * @returns A View component with the time and suffix in a row, or null if text is not provided
 */
const DisplayTime = ({
  time,
  suffix,
  bold,
}: {
  time?: Date;
  suffix?: string;
  bold?: boolean;
}) =>
  time && (
    <View className="flex-row items-center justify-center">
      <LegendText bold={bold}>{toDisplayTime(time)}</LegendText>
      {suffix && <LegendText bold={false}>{` ${suffix}`}</LegendText>}
    </View>
  );

/**
 * Renders text with consistent styling for progress meter labels.
 * Applies small text size with tight leading, and conditionally applies bold or light font weight.
 *
 * @param bold - Optional boolean to apply semibold font weight (default false, uses light weight)
 * @param children - React node content to display as text
 * @returns A Text component with standardized label styling
 */
const LegendText = ({
  bold,
  children,
}: PropsWithChildren<{ bold?: boolean }>) => (
  <Text
    className={`text-xs tracking-tight leading-tight ${bold ? "font-semibold" : "font-light "}`}
  >
    {children}
  </Text>
);

// ============================================================================
// Time Selection Helpers
// ============================================================================

/**
 * Gets the departure time for a trip, prioritizing actual over predicted over scheduled.
 * Used for progress bar start times when vessel is at sea.
 *
 * @param trip - The vessel trip object
 * @returns Departure time Date, or undefined if none available
 */
const getDepartureTime = (trip: VesselTrip): Date | undefined =>
  trip.LeftDock || trip.AtDockDepartCurr?.PredTime || trip.ScheduledDeparture;

/**
 * Gets the arrival time for a trip, prioritizing ETA over predicted times.
 *
 * @param trip - The vessel trip object
 * @returns Arrival time Date, or undefined if none available
 */
const getArrivalTime = (trip: VesselTrip): Date | undefined =>
  trip.Eta || trip.AtSeaArriveNext?.PredTime || trip.AtDockArriveNext?.PredTime;

export default TripProgressMeter;
