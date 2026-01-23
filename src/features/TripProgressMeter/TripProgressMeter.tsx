/**
 * TripProgressMeter component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import { View } from "react-native";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { cn } from "@/lib/utils";
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
        "relative flex-row items-center justify-between w-full overflow-visible m-2",
        className
      )}
    >
      <TripProgressBar
        startTimeMs={arriveATimeMs}
        endTimeMs={departATimeMs}
        leftCircleLabel="Arrive A"
        rightCircleLabel="Depart A"
        active={isAtDock}
      />

      <TripProgressBar
        startTimeMs={departATimeMs}
        endTimeMs={arriveBTimeMs}
        leftCircleLabel=""
        rightCircleLabel="Arrive B"
        active={!isAtDock}
      />
    </View>
  );
};

export default TripProgressMeter;
