/**
 * TripProgressMeter component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import TripProgressBar from "./shared/TripProgressBar";
import TripProgressLabel from "./shared/TripProgressLabel";
import { PropsWithChildren } from "react";

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
  const arrivalTime = trip.TripStart;
  const predictedDepartureTime = getPredictedDepartureTime(trip);
  const departureTime = getDepartureTime(trip);
  const predictedArrivalTime = getArrivalTime(trip);

  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible m-2 pr-4",
        className,
      )}
    >
      <TripProgressLabel>
        <AtDockStartLabel trip={trip} />
      </TripProgressLabel>
      <TripProgressBar
        startTimeMs={arrivalTime?.getTime() || undefined}
        endTimeMs={predictedDepartureTime?.getTime() || undefined}
        status={trip.AtDock ? "InProgress" : "Completed"}
        vesselName={getVesselName(trip.VesselAbbrev)}
      />
      <TripProgressLabel>
        <AtDockDepartLabel
          trip={trip}
          predictedDepartureTime={predictedDepartureTime}
        />
      </TripProgressLabel>
      <TripProgressBar
        startTimeMs={departureTime?.getTime() || undefined}
        endTimeMs={predictedArrivalTime?.getTime() || undefined}
        status={!trip.AtDock ? "InProgress" : "Pending"}
        vesselName={getVesselName(trip.VesselAbbrev)}
      />
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
const AtDockStartLabel = ({ trip }: { trip: VesselTrip }) => (
  <View className="flex-col items-center justify-center mt-3">
    <DepartingTerminalText trip={trip} />
    <ActualTripStartTime trip={trip} />
  </View>
);

/**
 * Renders the label for the right circle of the at-dock progress bar.
 * Conditionally displays predicted departure time (when at dock), actual departure time (when left),
 * and scheduled departure time (if available).
 *
 * @param trip - VesselTrip object containing trip data
 * @param predictedDepartureTime - Optional predicted departure time Date
 * @returns A View component with departure status text and time information
 */
const AtDockDepartLabel = ({
  trip,
  predictedDepartureTime,
}: {
  trip: VesselTrip;
  predictedDepartureTime?: Date;
}) => (
  <View className="flex-col items-center justify-center mt-3">
    <AtDockText trip={trip} />
    {trip.AtDock && (
      <PredictedDepartureTime predictedDepartureTime={predictedDepartureTime} />
    )}
    {!trip.AtDock && <ActualDepartureTime trip={trip} />}
    {trip.ScheduledDeparture && <ScheduledDepartureTime trip={trip} />}
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
  <View className="flex-col items-center justify-center mt-3">
    <ArrivalTerminalText trip={trip} />
    <ArrivalTime trip={trip} />
  </View>
);

/**
 * Displays the text "Arrived" followed by the departing terminal abbreviation.
 *
 * @param trip - VesselTrip object containing terminal abbreviation data
 * @returns A LegendText component with the text "Arrived" followed by the departing terminal abbreviation
 */
const DepartingTerminalText = ({ trip }: { trip: VesselTrip }) => (
  <LegendText bold={false}>
    {`Arrived ${trip.DepartingTerminalAbbrev}`}
  </LegendText>
);

/**
 * Displays the actual trip start time for the vessel trip.
 *
 * @param trip - VesselTrip object containing TripStart time data
 * @returns A DisplayTime component with the actual trip start time, or null if TripStart is not available
 */
const ActualTripStartTime = ({ trip }: { trip: VesselTrip }) =>
  trip.TripStart && (
    <DisplayTime text={toDisplayTime(trip.TripStart)} suffix="" bold />
  );

/**
 * Displays the text "Leave" or "Left" followed by the terminal abbreviation.
 * Shows "Leave" when vessel is at dock, "Left" when it has departed.
 *
 * @param trip - VesselTrip object containing AtDock status and terminal abbreviation
 * @returns A LegendText component with conditional text based on vessel dock status
 */
const AtDockText = ({ trip }: { trip: VesselTrip }) => (
  <LegendText bold={false}>
    {trip.AtDock ? "Leave" : "Left"} {trip.DepartingTerminalAbbrev}
  </LegendText>
);

/**
 * Displays the predicted departure time with "ETD" suffix.
 *
 * @param predictedDepartureTime - Optional Date object for predicted departure time
 * @returns A DisplayTime component with the predicted departure time and "ETD" suffix, or null if time is not available
 */
const PredictedDepartureTime = ({
  predictedDepartureTime,
}: {
  predictedDepartureTime?: Date;
}) =>
  predictedDepartureTime && (
    <DisplayTime
      text={toDisplayTime(predictedDepartureTime)}
      suffix="ETD"
      bold
    />
  );

/**
 * Displays the actual departure time for the vessel trip.
 *
 * @param trip - VesselTrip object containing LeftDock time data
 * @returns A DisplayTime component with the actual departure time, or null if LeftDock is not available
 */
const ActualDepartureTime = ({ trip }: { trip: VesselTrip }) =>
  trip.LeftDock && (
    <DisplayTime text={toDisplayTime(trip.LeftDock)} suffix="" bold />
  );

/**
 * Displays the scheduled departure time with "Sched" suffix.
 *
 * @param trip - VesselTrip object containing ScheduledDeparture time data
 * @returns A DisplayTime component with the scheduled departure time and "Sched" suffix, or null if ScheduledDeparture is not available
 */
const ScheduledDepartureTime = ({ trip }: { trip: VesselTrip }) =>
  trip.ScheduledDeparture && (
    <DisplayTime text={toDisplayTime(trip.ScheduledDeparture)} suffix="Sched" />
  );

/**
 * Displays the text "Arrived" or "Arrives" followed by the arriving terminal abbreviation.
 * Shows "Arrived" when trip has ended, "Arrives" when trip is in progress.
 *
 * @param trip - VesselTrip object containing TripEnd status and terminal abbreviation
 * @returns A LegendText component with conditional text based on trip completion status
 */
const ArrivalTerminalText = ({ trip }: { trip: VesselTrip }) => (
  <LegendText bold={false}>
    {`${trip.TripEnd ? "Arrived" : "Arrives"} ${trip.ArrivingTerminalAbbrev}`}
  </LegendText>
);

/**
 * Displays the arrival time for the vessel trip.
 * Shows actual arrival time with no suffix if trip has ended, or predicted arrival time with "ETA" suffix if in progress.
 *
 * @param trip - VesselTrip object containing TripEnd status and arrival time data
 * @returns A DisplayTime component with the arrival time, or null if no arrival time is available
 */
const ArrivalTime = ({ trip }: { trip: VesselTrip }) => {
  const arrivalTime = trip.TripEnd ? trip.TripEnd : getArrivalTime(trip);
  return (
    arrivalTime && (
      <DisplayTime
        text={toDisplayTime(arrivalTime)}
        suffix={trip.TripEnd ? undefined : "ETA"}
        bold
      />
    )
  );
};

/**
 * Displays a formatted time string with an optional suffix and bold styling.
 * Renders the time text and suffix in a horizontal row with centered alignment.
 *
 * @param text - Optional string containing the formatted time to display
 * @param suffix - Optional string suffix to display after the time (e.g., "ETD", "ETA", "Sched")
 * @param bold - Optional boolean to apply bold styling to the time text (default false)
 * @returns A View component with the time and suffix in a row, or null if text is not provided
 */
const DisplayTime = ({
  text,
  suffix,
  bold,
}: {
  text?: string;
  suffix?: string;
  bold?: boolean;
}) =>
  text && (
    <View className="flex-row items-center justify-center">
      <LegendText bold={bold}>{text}</LegendText>
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
    className={`text-xs leading-tight ${bold ? "font-semibold" : "font-light "}`}
  >
    {children}
  </Text>
);

// ============================================================================
// Time Selection Helpers
// ============================================================================

/**
 * Gets the predicted or scheduled departure time (excludes actual departure).
 * Used for progress bar end times when vessel is at dock.
 *
 * @param trip - The vessel trip object
 * @returns Predicted or scheduled departure time Date, or undefined if none available
 */
const getPredictedDepartureTime = (trip: VesselTrip): Date | undefined =>
  trip.AtDockDepartCurr?.PredTime || trip.ScheduledDeparture;

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
