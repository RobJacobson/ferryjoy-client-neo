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
import TripProgressBar from "./TripProgressBar";

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
 *
 * The indicator is shown based on vessel state (AtDock property) rather than time-based progress,
 * allowing it to display correctly even when vessels are running late.
 *
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data
 * @param className - Optional className for styling the meter container
 * @returns A View component with two self-contained progress bars
 */
const TripProgressMeter = ({ trip, className }: TripProgressMeterProps) => {
  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible m-2 pr-4",
        className
      )}
    >
      <AtDockProgressBar trip={trip} />
      <AtSeaProgressBar trip={trip} />
    </View>
  );
};

const AtDockProgressBar = ({ trip }: { trip: VesselTrip }) => {
  const status = trip.AtDock ? "InProgress" : "Completed";
  const arrivalTime = trip.TripStart;
  const predictedDepartureTime = getPredictedDepartureTime(trip);

  const leftCircleLabel = (
    <View className="flex-col items-center justify-center mt-1">
      <DepartingTerminalText trip={trip} />
      <ActualTripStartTime trip={trip} />
    </View>
  );

  const rightCircleLabel = (
    <View className="flex-col items-center justify-center mt-1">
      <AtDockText trip={trip} />
      {trip.AtDock && (
        <PredictedDepartureTime
          predictedDepartureTime={predictedDepartureTime}
        />
      )}
      {!trip.AtDock && <ActualDepartureTime trip={trip} />}
      {trip.ScheduledDeparture && <ScheduledDepartureTime trip={trip} />}
    </View>
  );

  return (
    <TripProgressBar
      startTimeMs={arrivalTime?.getTime() || undefined}
      endTimeMs={predictedDepartureTime?.getTime() || undefined}
      leftCircleLabel={leftCircleLabel}
      rightCircleLabel={rightCircleLabel}
      status={status}
      vesselName={getVesselName(trip.VesselAbbrev)}
    />
  );
};

const AtSeaProgressBar = ({ trip }: { trip: VesselTrip }) => {
  const departureTime = getDepartureTime(trip);
  const predictedArrivalTime = getArrivalTime(trip);

  const status = !trip.AtDock ? "InProgress" : "Pending";

  const rightCircleLabel = (
    <View className="flex-col items-center justify-center mt-1">
      <ArrivalTerminalText trip={trip} />
      <ArrivalTime trip={trip} />
    </View>
  );

  return (
    <TripProgressBar
      startTimeMs={departureTime?.getTime() || undefined}
      endTimeMs={predictedArrivalTime?.getTime() || undefined}
      leftCircleLabel={undefined}
      rightCircleLabel={rightCircleLabel}
      status={status}
      vesselName={getVesselName(trip.VesselAbbrev)}
    />
  );
};

/**
 * Displays the text "Arrived" followed by the departing terminal abbreviation.
 * @param trip - The vessel trip object.
 * @returns A Text component with the text "Arrived" followed by the departing terminal abbreviation.
 */
const DepartingTerminalText = ({ trip }: { trip: VesselTrip }) => (
  <Text className="text-xs leading-tight font-light text-center">
    {`Arrived ${trip.DepartingTerminalAbbrev}`}
  </Text>
);

/**
 * Displays the actual trip start time for the vessel trip.
 * @param trip - The vessel trip object.
 * @returns A DisplayTime component with the actual trip start time.
 */
const ActualTripStartTime = ({ trip }: { trip: VesselTrip }) =>
  trip.TripStart && (
    <DisplayTime text={toDisplayTime(trip.TripStart)} suffix="" bold />
  );

/**
 * Displays the text "Leave" or "Left" followed by the terminal abbreviation.
 * @param trip - The vessel trip object.
 * @returns A Text component with the text "Leave" or "Left" followed by the terminal abbreviation.
 */
const AtDockText = ({ trip }: { trip: VesselTrip }) => (
  <Text className="text-xs leading-tight font-light text-center">
    {trip.AtDock ? "Leave" : "Left"} {trip.DepartingTerminalAbbrev}
  </Text>
);

/**
 * Displays the predicted departure time when the vessel is at dock.
 * @param trip - The vessel trip object.
 * @returns A DisplayTime component with the predicted departure time, or null if not at dock.
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
 * @param trip - The vessel trip object.
 * @returns An ArriveActualLegend component with the actual departure time.
 */
const ActualDepartureTime = ({ trip }: { trip: VesselTrip }) =>
  trip.LeftDock && (
    <DisplayTime text={toDisplayTime(trip.LeftDock)} suffix="" bold />
  );

/**
 * Displays the scheduled departure time for the vessel trip.
 * @param trip - The vessel trip object.
 * @returns A DisplayTime component with the scheduled departure time.
 */
const ScheduledDepartureTime = ({ trip }: { trip: VesselTrip }) =>
  trip.ScheduledDeparture && (
    <DisplayTime text={toDisplayTime(trip.ScheduledDeparture)} suffix="sched" />
  );

/**
 * Displays the text "Arrive" followed by the arriving terminal abbreviation.
 * @param trip - The vessel trip object.
 * @returns A Text component with the text "Arrive" followed by the arriving terminal abbreviation.
 */
const ArrivalTerminalText = ({ trip }: { trip: VesselTrip }) => (
  <Text className="text-xs leading-tight font-light text-center">
    {`${trip.TripEnd ? "Arrived" : "Arrives"} ${trip.ArrivingTerminalAbbrev}`}
  </Text>
);

/**
 * Displays the predicted arrival time for the vessel trip.
 * @param trip - The vessel trip object.
 * @returns A DisplayTime component with the predicted arrival time.
 */
const ArrivalTime = ({ trip }: { trip: VesselTrip }) => {
  const arrivalTime = trip.TripEnd ? trip.TripEnd : getArrivalTime(trip);
  return arrivalTime ? (
    <DisplayTime
      text={toDisplayTime(arrivalTime)}
      suffix={trip.TripEnd ? undefined : "ETA"}
      bold
    />
  ) : null;
};

/**
 * Displays a time with an optional suffix and bold styling.
 * @param time - The time to display.
 * @param suffix - The suffix to display.
 * @param bold - Whether to display the time in bold.
 * @returns A Text component with the time and suffix.
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
      <Text
        className={cn(
          "text-xs leading-tight text-center font-light",
          bold && "font-semibold"
        )}
      >
        {text}
      </Text>
      {suffix && (
        <Text variant="muted" className="text-xs leading-tight font-light">
          {` ${suffix}`}
        </Text>
      )}
    </View>
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
