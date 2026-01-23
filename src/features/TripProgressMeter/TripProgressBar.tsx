/**
 * TripProgressBar component for rendering individual progress segments in the trip progress meter.
 * Displays a horizontal progress bar that calculates progress based on numeric values.
 * Uses FlexBox flex-grow for proportional width allocation based on segment duration,
 * with a minimum width of 15%.
 * Used as a building block within TripProgressMeter to create multi-segment progress visualizations.
 */

import { useEffect, useState } from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";
import { clamp } from "@/shared/utils";
import { STACKING, shadowStyle } from "./config";
import TripProgressCircle from "./TripProgressCircle";
import TripProgressIndicator from "./TripProgressIndicator";

// ============================================================================
// Types
// ============================================================================

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
   * Whether to show the circle at the left end of the bar.
   */
  showLeftCircle?: boolean;
  /**
   * Whether to show the circle at the right end of the bar.
   */
  showRightCircle?: boolean;
  /**
   * Label text for the left circle (displayed below the circle).
   */
  leftCircleLabel?: string;
  /**
   * Label text for the right circle (displayed below the circle).
   */
  rightCircleLabel?: string;
  /**
   * Whether this bar is active. Active bars show a progress indicator
   * and have a higher z-index than inactive bars.
   */
  active?: boolean;
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
 * Width is determined internally via FlexBox flex-grow based on segment duration,
 * with a minimum of 15% to ensure readability. Current time is obtained internally.
 *
 * @param startTimeMs - Start time in milliseconds for progress calculation
 * @param endTimeMs - End time in milliseconds for progress calculation
 * @param showLeftCircle - Whether to show left circle (default true)
 * @param showRightCircle - Whether to show right circle (default true)
 * @param leftCircleLabel - Label text for left circle
 * @param rightCircleLabel - Label text for right circle
 * @param active - Whether this bar is active (shows indicator and higher z-index)
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
  active = false,
  zIndex,
  className,
  style,
}: TripProgressBarProps) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const progress = calculateProgress(startTimeMs, endTimeMs, nowMs);
  const minutesRemaining = calculateMinutesRemaining(endTimeMs, nowMs);

  // Calculate flex-grow proportional to segment duration
  const durationMs = calculateDurationMs(startTimeMs, endTimeMs);
  const flexGrow = durationMs; // Use duration directly for proportional sizing

  // Active bars have higher z-index
  const effectiveZIndex = active
    ? STACKING.activeBar
    : (zIndex ?? STACKING.bar);

  // Establish z-order: indicator > circles > labels > progress bar
  const circlesZIndex = effectiveZIndex + 1;
  const labelsZIndex = effectiveZIndex;
  const indicatorZIndex = effectiveZIndex + 2;

  return (
    <View
      className={cn("relative", className)}
      style={{
        overflow: "visible",
        zIndex: effectiveZIndex,
        elevation: effectiveZIndex,
        flexGrow,
        minWidth: "20%",
        ...style,
      }}
    >
      {/* Left circle at 0% position */}
      {showLeftCircle && (
        <TripProgressCircle
          left="0%"
          backgroundColor="bg-white"
          borderColor="border border-pink-500"
          zIndex={circlesZIndex}
        />
      )}
      {showLeftCircle && leftCircleLabel && (
        <CircleLabel label={leftCircleLabel} zIndex={labelsZIndex} />
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
        <TripProgressCircle
          left="100%"
          backgroundColor="bg-white"
          borderColor="border border-pink-500"
          zIndex={circlesZIndex}
        />
      )}
      {showRightCircle && rightCircleLabel && (
        <CircleLabel label={rightCircleLabel} isRight zIndex={labelsZIndex} />
      )}

      {/* Progress indicator when active */}
      {active && (
        <TripProgressIndicator
          progress={progress}
          minutesRemaining={minutesRemaining}
          zIndex={indicatorZIndex}
        />
      )}
    </View>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

type CircleLabelProps = {
  label: string;
  isRight?: boolean;
  zIndex?: number;
};

/**
 * Renders a label positioned below a circle marker.
 *
 * @param label - Label text to display
 * @param isRight - Whether this is the right circle (affects position)
 * @param zIndex - Optional z-index for stacking order
 * @returns A View component with the label
 */
const CircleLabel = ({ label, isRight, zIndex }: CircleLabelProps) => {
  const [labelWidth, setLabelWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setLabelWidth((prev) => (prev === width ? prev : width));
  };

  return (
    <View
      className="absolute"
      style={{
        top: "100%",
        left: isRight ? "100%" : "0%",
        transform: [{ translateX: -labelWidth / 2 }],
        marginTop: 8,
        zIndex,
      }}
      onLayout={handleLayout}
    >
      <Text className="text-sm">{label}</Text>
    </View>
  );
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculates progress value (0-1) from time values.
 *
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @param currentTimeMs - Current time in milliseconds
 * @returns Progress value between 0 and 1
 */
export const calculateProgress = (
  startTimeMs?: number,
  endTimeMs?: number,
  currentTimeMs?: number
): number => {
  if (
    startTimeMs === undefined ||
    endTimeMs === undefined ||
    currentTimeMs === undefined
  ) {
    return 0;
  }

  // Handle invalid time ordering
  if (endTimeMs <= startTimeMs) {
    return currentTimeMs >= endTimeMs ? 1 : 0;
  }

  // Calculate progress using linear interpolation and clamp to [0, 1]
  const progressValue =
    (currentTimeMs - startTimeMs) / (endTimeMs - startTimeMs);
  return clamp(progressValue, 0, 1);
};

/**
 * Calculates duration in milliseconds between two times.
 *
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns Non-negative duration in milliseconds, or 0 if missing/invalid
 */
const calculateDurationMs = (
  startTimeMs?: number,
  endTimeMs?: number
): number => {
  if (startTimeMs === undefined || endTimeMs === undefined) {
    return 1;
  }

  return Math.max(0, endTimeMs - startTimeMs);
};

/**
 * Calculates minutes remaining until an end time from current time.
 *
 * @param endTimeMs - End time in milliseconds
 * @param currentTimeMs - Current time in milliseconds
 * @returns Minutes remaining, rounded up, or 0 if missing/elapsed
 */
const calculateMinutesRemaining = (
  endTimeMs?: number,
  currentTimeMs?: number
): number => {
  if (endTimeMs === undefined || currentTimeMs === undefined) {
    return 0;
  }

  const remainingMs = endTimeMs - currentTimeMs;
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / (1000 * 60));
};

export default TripProgressBar;
