/**
 * TripProgressBar component for rendering individual progress segments in trip progress meter.
 * Displays a horizontal progress bar that calculates progress based on numeric values.
 * Uses FlexBox flex-grow for proportional width allocation based on segment duration.
 * Used as a building block within TripProgressMeter to create multi-segment progress visualizations.
 */

import type { ViewStyle } from "react-native";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { useTripProgressTime } from "@/data/contexts";
import { cn } from "@/lib/utils";
import { clamp } from "@/shared/utils";
import { STACKING, shadowStyle } from "./config";
import TripProgressIndicator from "./TripProgressIndicator";
import TripProgressMarker from "./TripProgressMarker";

// ============================================================================
// Types
// ============================================================================

export type TripProgressBarStatus = "Pending" | "InProgress" | "Completed";

type TripProgressBarProps = {
  /**
   * Start time in milliseconds for progress calculation.
   */
  startTimeMs?: number;
  /**
   * End time in milliseconds for progress calculation.
   */
  endTimeMs?: number;
  /**
   * Whether to show circle at the left end of the bar.
   */
  showLeftCircle?: boolean;
  /**
   * Whether to show circle at the right end of the bar.
   */
  showRightCircle?: boolean;
  /**
   * Label text for the left circle (displayed below the circle).
   */
  leftCircleLabel?: React.ReactNode;
  /**
   * Label text for the right circle (displayed below the circle).
   */
  rightCircleLabel?: React.ReactNode;
  /**
   * Status of the progress bar segment.
   * - "Pending": Progress locked at 0%, no indicator shown
   * - "InProgress": Progress displays normally, indicator shown
   * - "Completed": Progress displays normally, indicator not shown
   */
  status?: TripProgressBarStatus;
  /**
   * Optional vessel name to display above the progress indicator when in progress.
   */
  vesselName?: string;
  zIndex?: number;
  className?: string;
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a horizontal progress bar that calculates progress automatically from time values.
 * The bar consists of a background track, a filled progress portion, optional circles at each end,
 * and optionally a progress indicator when active.
 *
 * Width is determined via FlexBox flex: 1 for proportional sizing.
 * Current time is obtained from context.
 *
 * @param startTimeMs - Start time in milliseconds for progress calculation
 * @param endTimeMs - End time in milliseconds for progress calculation
 * @param showLeftCircle - Whether to show left circle (default true)
 * @param showRightCircle - Whether to show right circle (default true)
 * @param leftCircleLabel - Label text for left circle
 * @param rightCircleLabel - Label text for right circle
 * @param status - Status of the progress bar segment (default "Pending")
 * @param vesselName - Optional vessel name to display above the indicator when in progress
 * @param zIndex - Z-index for layering the progress bar
 * @param className - Additional CSS classes for styling
 * @param style - Additional inline styles
 * @returns A View containing the progress bar with circles and optional indicator
 */
const TripProgressBar = ({
  startTimeMs,
  endTimeMs,
  showLeftCircle = true,
  showRightCircle = true,
  leftCircleLabel,
  rightCircleLabel,
  status = "Pending",
  vesselName,
  zIndex,
  className,
  style,
}: TripProgressBarProps) => {
  const nowMs = useTripProgressTime();

  // Calculate progress
  const progress = calculateProgress(status, nowMs, startTimeMs, endTimeMs);

  // Calculate minutes remaining inline
  const minutesRemaining =
    endTimeMs === undefined || nowMs === undefined
      ? 0
      : Math.max(0, Math.ceil((endTimeMs - nowMs) / (1000 * 60)));

  // InProgress bars have higher z-index
  const isActive = status === "InProgress";
  const effectiveZIndex = isActive
    ? STACKING.activeBar
    : (zIndex ?? STACKING.bar);

  return (
    <View
      className={cn("relative", className)}
      style={{
        overflow: "visible",
        zIndex: effectiveZIndex,
        elevation: effectiveZIndex,
        flex: 1,
        minWidth: "25%",
        ...style,
      }}
    >
      {/* Left circle at 0% position */}
      {showLeftCircle && (
        <TripProgressMarker
          left="0%"
          backgroundColor="bg-white"
          borderColor="border border-pink-500"
          zIndex={effectiveZIndex + 1}
        />
      )}
      {showLeftCircle && leftCircleLabel && (
        <CircleLabel label={leftCircleLabel} zIndex={effectiveZIndex} />
      )}

      {/* Progress bar */}
      <View className="flex-1 bg-primary/20 rounded-full h-3 items-start">
        <View
          className="bg-pink-300 rounded-full h-full"
          style={{ width: `${progress * 100}%`, ...shadowStyle }}
        />
      </View>

      {/* Right circle at 100% position */}
      {showRightCircle && (
        <TripProgressMarker
          left="100%"
          backgroundColor="bg-white"
          borderColor="border border-pink-500"
          zIndex={effectiveZIndex + 1}
        />
      )}
      {showRightCircle && rightCircleLabel && (
        <CircleLabel
          label={rightCircleLabel}
          isRight
          zIndex={effectiveZIndex}
        />
      )}

      {/* Progress indicator when in progress */}
      {isActive && (
        <TripProgressIndicator
          progress={progress}
          minutesRemaining={minutesRemaining}
          zIndex={effectiveZIndex + 2}
          labelAbove={vesselName}
        />
      )}
    </View>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates progress value based on time range and status.
 *
 * @param status - Current status of the progress segment
 * @param nowMs - Current time in milliseconds
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns Progress value between 0 and 1
 */
const calculateProgress = (
  status: TripProgressBarStatus,
  nowMs: number,
  startTimeMs?: number,
  endTimeMs?: number,
): number => {
  // No progress for pending segments or missing time data
  if (status === "Pending" || !startTimeMs || !endTimeMs) {
    return 0;
  }

  // Completed segments are fully complete
  if (status === "Completed") {
    return 1;
  }

  // Handle invalid time ranges
  if (endTimeMs <= startTimeMs) {
    return nowMs >= endTimeMs ? 1 : 0;
  }

  // Past the end time means fully complete
  if (nowMs >= endTimeMs) {
    return 1;
  }

  // Calculate proportional progress within valid time range
  return clamp((nowMs - startTimeMs) / (endTimeMs - startTimeMs), 0, 1);
};

// ============================================================================
// Helper Components
// ============================================================================

type CircleLabelProps = {
  label: React.ReactNode;
  isRight?: boolean;
  zIndex?: number;
};

/**
 * Renders a label positioned below a circle marker using CSS centering.
 *
 * @param label - Label text to display
 * @param isRight - Whether this is the right circle (affects position)
 * @param zIndex - Optional z-index for stacking order
 * @returns A View component with the label
 */
const CircleLabel = ({ label, isRight, zIndex }: CircleLabelProps) => {
  const wrappedLabel =
    typeof label === "string" || typeof label === "number" ? (
      <Text className="text-xs leading-tight font-light text-center">
        {label}
      </Text>
    ) : (
      label
    );

  return (
    <View
      className="absolute"
      style={{
        top: "100%",
        left: isRight ? "100%" : "0%",
        transform: [{ translateX: "-50%" }],
        marginTop: 8,
        zIndex,
      }}
    >
      {wrappedLabel}
    </View>
  );
};

export default TripProgressBar;
