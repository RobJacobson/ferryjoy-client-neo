/**
 * TripProgressMeter component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import { View } from "react-native";
import { Text } from "@/components/ui";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { cn } from "@/lib/utils";
import { STACKING } from "./config";
import TripProgressBar from "./TripProgressBar";
import TripProgressIndicator from "./TripProgressIndicator";
import TripProgressMarker from "./TripProgressMarker";
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
 * with minimum/maximum constraints to ensure readability.
 *
 * The indicator is shown based on vessel state (AtDock property) rather than time-based progress,
 * allowing it to display correctly even when vessels are running late.
 *
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data
 * @param className - Optional className for styling the meter container
 * @returns A View component with two progress bars, three markers, and optionally overlaid progress indicators
 */
const TripProgressMeter = ({ trip, className }: TripProgressMeterProps) => {
  const {
    nowMs,
    arriveATimeMs,
    departATimeMs,
    arriveBTimeMs,
    firstWidthPercent,
    secondWidthPercent,
    indicatorModel,
  } = useTripProgressMeterModel(trip);

  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible m-2",
        className
      )}
    >
      <TripProgressMarker zIndex={STACKING.marker}>
        <View>
          <Text className="text-sm">Arrive A</Text>
        </View>
      </TripProgressMarker>

      <TripProgressBar
        startValue={arriveATimeMs}
        endValue={departATimeMs}
        currentValue={nowMs}
        percentWidth={firstWidthPercent}
        zIndex={STACKING.bar}
      />

      <TripProgressMarker zIndex={STACKING.marker}>
        <View>
          <Text className="text-sm">Depart A</Text>
        </View>
      </TripProgressMarker>

      <TripProgressBar
        startValue={departATimeMs}
        endValue={arriveBTimeMs}
        currentValue={nowMs}
        percentWidth={secondWidthPercent}
        zIndex={STACKING.bar}
      />

      <TripProgressMarker zIndex={STACKING.marker}>
        <View>
          <Text className="text-sm">Arrive B</Text>
        </View>
      </TripProgressMarker>

      <TripProgressIndicator indicatorModel={indicatorModel} />
    </View>
  );
};

export default TripProgressMeter;
