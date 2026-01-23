/**
 * TripProgressBar component for rendering individual progress segments in the trip progress meter.
 * Displays a horizontal progress bar that calculates progress based on numeric values.
 * Used as a building block within TripProgressMeter to create multi-segment progress visualizations.
 */

import { View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { clamp } from "@/shared/utils";
import { shadowStyle } from "./config";

// ============================================================================
// Types
// ============================================================================

type TripProgressBarProps = {
  /**
   * Start value for progress calculation.
   */
  startValue?: number;
  /**
   * End value for progress calculation.
   */
  endValue?: number;
  /**
   * Current value for progress calculation.
   */
  currentValue: number;
  /**
   * Width as a percentage (0-100).
   */
  percentWidth?: number;
  zIndex?: number;
  className?: string;
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a horizontal progress bar that calculates progress automatically from numeric values.
 * The bar consists of a background track and a filled progress portion.
 *
 * @param startValue - Start value for progress calculation
 * @param endValue - End value for progress calculation
 * @param currentValue - Current value for progress calculation
 * @param percentWidth - Width as percentage (0-100), otherwise uses flex-1
 * @param zIndex - Z-index for layering the progress bar
 * @param className - Additional CSS classes for styling
 * @param style - Additional inline styles
 * @returns A View containing the progress bar
 */
const TripProgressBar = ({
  startValue,
  endValue,
  currentValue,
  percentWidth,
  zIndex,
  className,
  style,
}: TripProgressBarProps) => {
  const progress = calculateProgress(startValue, endValue, currentValue);

  // Use flex-1 if no explicit width is provided.
  const hasExplicitWidth = percentWidth !== undefined;
  const flexClass = hasExplicitWidth ? "" : "flex-1";

  return (
    <View
      className={cn("relative", flexClass, className)}
      style={{
        overflow: "visible",
        zIndex,
        elevation: zIndex,
        ...(percentWidth !== undefined && { width: `${percentWidth}%` }),
        ...style,
      }}
    >
      <View
        className="flex-1 bg-primary/20 rounded-full h-3 items-start"
        style={{ zIndex: 1 }}
      >
        <View
          className="bg-pink-300 rounded-full h-full"
          style={{ width: `${progress * 100}%`, zIndex: 1, ...shadowStyle }}
        />
      </View>
    </View>
  );
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculates progress value (0-1) from time values.
 *
 * @param startValue - Start value
 * @param endValue - End value
 * @param currentValue - Current value
 * @returns Progress value between 0 and 1
 */
export const calculateProgress = (
  startValue?: number,
  endValue?: number,
  currentValue?: number
): number => {
  if (
    startValue === undefined ||
    endValue === undefined ||
    currentValue === undefined
  ) {
    return 0;
  }

  // Handle invalid time ordering
  if (endValue <= startValue) {
    return currentValue >= endValue ? 1 : 0;
  }

  // Calculate progress using linear interpolation and clamp to [0, 1]
  const progressValue = (currentValue - startValue) / (endValue - startValue);
  return clamp(progressValue, 0, 1);
};

export default TripProgressBar;
