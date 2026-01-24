/**
 * TripProgressMeter component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import { View } from "react-native";
import { Text } from "@/components/ui";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import TripProgressBar from "./TripProgressBar";
import { useTripProgressMeterModel } from "./useTripProgressMeterModel";

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
  const { arriveATimeMs, departATimeMs, arriveBTimeMs, isAtDock } =
    useTripProgressMeterModel(trip);

  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible m-2 pr-4",
        className,
      )}
    >
      <AtDockProgressBar trip={trip} />
      <AtSeaProgressBar trip={trip} />
    </View>
  );
};

const AtDockProgressBar = ({ trip }: { trip: VesselTrip }) => {
  const isActive = trip.AtDock;
  const { arriveATimeMs, departATimeMs } = useTripProgressMeterModel(trip);

  const leftCircleLabel = (
    <View className="flex-col items-center justify-center">
      <DepartingTerminalText trip={trip} />
      <ActualTripStartTime trip={trip} />
    </View>
  );

  const rightCircleLabel = (
    <View className="flex-col items-center justify-center">
      <AtDockText trip={trip} />
      <PredictedDepartureTime trip={trip} />
      <ActualDepartureTime trip={trip} />
      <ScheduledDepartureTime trip={trip} />
    </View>
  );

  return (
    <TripProgressBar
      startTimeMs={arriveATimeMs}
      endTimeMs={departATimeMs}
      leftCircleLabel={leftCircleLabel}
      rightCircleLabel={rightCircleLabel}
      isActive={isActive}
    />
  );
};

const AtSeaProgressBar = ({ trip }: { trip: VesselTrip }) => {
  const isActive = !trip.AtDock;
  const { departATimeMs, arriveBTimeMs } = useTripProgressMeterModel(trip);

  const predictedArrivalTime =
    trip.Eta ||
    trip.AtSeaArriveNext?.PredTime ||
    trip.AtDockArriveNext?.PredTime;

  const rightCircleLabel = (
    <View className="flex-col items-center justify-center">
      <ArrivalTerminalText trip={trip} />
      <PredictedArrivalTime time={predictedArrivalTime} />
    </View>
  );

  return (
    <TripProgressBar
      startTimeMs={departATimeMs}
      endTimeMs={predictedArrivalTime?.getTime() || undefined}
      leftCircleLabel=""
      rightCircleLabel={rightCircleLabel}
      isActive={isActive}
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
const ActualTripStartTime = ({ trip }: { trip: VesselTrip }) => (
  <DisplayTime time={trip.TripStart} suffix="" bold />
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
const PredictedDepartureTime = ({ trip }: { trip: VesselTrip }) =>
  trip.AtDock && (
    <DisplayTime time={trip.AtDockDepartCurr?.PredTime} suffix="est" bold />
  );

/**
 * Displays the actual departure time for the vessel trip.
 * @param trip - The vessel trip object.
 * @returns An ArriveActualLegend component with the actual departure time.
 */
const ActualDepartureTime = ({ trip }: { trip: VesselTrip }) =>
  !trip.AtDock && <DisplayTime time={trip.LeftDock} suffix="" bold />;

/**
 * Displays the scheduled departure time for the vessel trip.
 * @param trip - The vessel trip object.
 * @returns A DisplayTime component with the scheduled departure time.
 */
const ScheduledDepartureTime = ({ trip }: { trip: VesselTrip }) => (
  <DisplayTime time={trip.ScheduledDeparture} suffix="sched" />
);

/**
 * Displays the text "Arrive" followed by the arriving terminal abbreviation.
 * @param trip - The vessel trip object.
 * @returns A Text component with the text "Arrive" followed by the arriving terminal abbreviation.
 */
const ArrivalTerminalText = ({ trip }: { trip: VesselTrip }) => (
  <Text className="text-xs leading-tight font-light text-center">
    {`Arrive ${trip.ArrivingTerminalAbbrev}`}
  </Text>
);

/**
 * Displays the predicted arrival time for the vessel trip.
 * @param trip - The vessel trip object.
 * @returns A DisplayTime component with the predicted arrival time.
 */
const PredictedArrivalTime = ({ time }: { time?: Date }) => (
  <DisplayTime time={time} suffix="est" bold />
);

/**
 * Displays a time with an optional suffix and bold styling.
 * @param time - The time to display.
 * @param suffix - The suffix to display.
 * @param bold - Whether to display the time in bold.
 * @returns A Text component with the time and suffix.
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
    <Text
      className={cn(
        "text-xs leading-tight text-center font-light",
        bold && "font-semibold",
      )}
    >
      {`${toDisplayTime(time)} ${suffix}`}
    </Text>
  );

export default TripProgressMeter;
