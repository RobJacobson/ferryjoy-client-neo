/**
 * TripProgressMeter component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import { PortalHost } from "@rn-primitives/portal";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { cn } from "@/lib/utils";
import { clamp } from "@/shared/utils";
import { STACKING, WIDTH_CONSTRAINTS } from "./config";
import TripProgressBar from "./TripProgressBar";
import TripProgressMarker from "./TripProgressMarker";

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
 * with minimum/maximum constraints to ensure readability. Progress indicators show minutes remaining
 * and are rendered via portal to overlay across the entire meter for clear visibility.
 *
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data
 * @param className - Optional className for styling the meter container
 * @returns A View component with two progress bars, three markers, and overlaid progress indicators
 */
const TripProgressMeter = ({ trip, className }: TripProgressMeterProps) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Extract and prioritize time values: actual > predicted > scheduled
  const arriveATimeMs = trip.TripStart?.getTime();
  const departATimeMs = getBestTimeMs(
    trip.LeftDock,
    trip.AtDockDepartCurr?.PredTime,
    trip.ScheduledDeparture
  );
  const arriveBTimeMs = getBestTimeMs(
    trip.TripEnd,
    trip.AtSeaArriveNext?.PredTime,
    trip.Eta
  );

  // Calculate segment durations, ensuring non-negative values
  const firstDurationMs = Math.max(
    0,
    (departATimeMs ?? 0) - (arriveATimeMs ?? 0)
  );
  const secondDurationMs = Math.max(
    0,
    (arriveBTimeMs ?? 0) - (departATimeMs ?? 0)
  );
  const totalDurationMs = firstDurationMs + secondDurationMs;

  // Calculate proportional widths based on duration ratios, with readability constraints
  let firstWidthPercent: number = WIDTH_CONSTRAINTS.defaultPercent; // Default fallback if no duration data
  if (totalDurationMs > 0) {
    firstWidthPercent = (firstDurationMs / totalDurationMs) * 100;
    // Clamp to ensure minimum visibility while preventing dominance of short segments
    firstWidthPercent = clamp(
      firstWidthPercent,
      WIDTH_CONSTRAINTS.minPercent,
      WIDTH_CONSTRAINTS.maxPercent
    );
  }

  const secondWidthPercent = 100 - firstWidthPercent;

  // Generate unique portal names to isolate progress indicators per trip instance
  const portalNames = createPortalNames(trip);

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
        startTimeMs={arriveATimeMs}
        endTimeMs={departATimeMs}
        currentTimeMs={nowMs}
        percentWidth={firstWidthPercent}
        startOffsetPercent={0}
        portalHostName={portalNames.host}
        portalName={portalNames.segment1}
        zIndex={STACKING.bar}
      />

      <TripProgressMarker zIndex={STACKING.marker}>
        <View>
          <Text className="text-sm">Depart A</Text>
        </View>
      </TripProgressMarker>

      <TripProgressBar
        startTimeMs={departATimeMs}
        endTimeMs={arriveBTimeMs}
        currentTimeMs={nowMs}
        percentWidth={secondWidthPercent}
        startOffsetPercent={firstWidthPercent}
        portalHostName={portalNames.host}
        portalName={portalNames.segment2}
        zIndex={STACKING.bar}
      />

      <TripProgressMarker zIndex={STACKING.marker}>
        <View>
          <Text className="text-sm">Arrive B</Text>
        </View>
      </TripProgressMarker>

      {/* Progress indicator layer (highest z-index) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: STACKING.progressCircle,
          elevation: STACKING.progressCircle,
        }}
      >
        <PortalHost name={portalNames.host} />
      </View>
    </View>
  );
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates unique portal names for a trip instance to isolate progress indicators.
 *
 * @param trip - VesselTrip object to generate names for
 * @returns Object containing host name and segment-specific portal names
 */
const createPortalNames = (trip: VesselTrip) => {
  const baseName = `trip-progress-meter-${trip.VesselAbbrev}-${trip.TimeStamp.getTime()}`;
  return {
    host: baseName,
    segment1: `${baseName}-segment-1-indicator`,
    segment2: `${baseName}-segment-2-indicator`,
  };
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Picks the best time value (actual > predicted > scheduled) as epoch ms.
 *
 * @param actual - Actual time value
 * @param predicted - Predicted time value
 * @param scheduled - Scheduled time value
 * @returns Epoch milliseconds for the best time, or undefined
 */
const getBestTimeMs = (
  actual?: Date,
  predicted?: Date,
  scheduled?: Date
): number | undefined => {
  if (actual) return actual.getTime();
  if (predicted) return predicted.getTime();
  return scheduled?.getTime();
};

export default TripProgressMeter;
