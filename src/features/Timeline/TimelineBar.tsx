/**
 * TimelineBar component for rendering individual progress segments in timeline meter.
 * Displays a horizontal progress bar that calculates progress based on numeric values.
 * Uses FlexBox flex-grow for proportional width allocation based on segment duration.
 * Used as a building block within TimelineMeter to create multi-segment progress visualizations.
 */

import type { ViewStyle } from "react-native";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { useTripProgressTime } from "@/data/contexts";
import { cn } from "@/lib/utils";
import { TimelineBarEndpoints } from "./TimelineBarEndpoints";
import { TimelineBarTrack } from "./TimelineBarTrack";
import TimelineIndicator from "./TimelineIndicator";
import { calculateTimeProgress, getMinutesRemaining } from "./utils";

// ============================================================================
// Types
// ============================================================================

export type TimelineBarStatus = "Pending" | "InProgress" | "Completed";

type TimelineBarProps = {
  /**
   * Start time in milliseconds for progress calculation.
   */
  startTimeMs?: number;
  /**
   * End time in milliseconds for progress calculation.
   */
  endTimeMs?: number;
  /**
   * Status of the progress bar segment.
   * - "Pending": Progress locked at 0%, no indicator shown
   * - "InProgress": Progress displays normally, indicator shown
   * - "Completed": Progress displays normally, indicator not shown
   */
  status: TimelineBarStatus;
  /**
   * Optional vessel name to display above the progress indicator when in progress.
   */
  vesselName?: string;
  /**
   * Size of the circle markers in pixels.
   */
  circleSize?: number;
  /**
   * Height of the progress bar in pixels.
   */
  barHeight?: number;
  className?: string;
  style?: ViewStyle;
  /**
   * ClassName applied to the track container (unfilled portion).
   * Defaults match current styling.
   */
  trackClassName?: string;
  /**
   * ClassName applied to the filled portion.
   * Defaults match current styling.
   */
  fillClassName?: string;
  /**
   * ClassName applied to endpoint circle markers (background + border).
   * Defaults match current styling.
   */
  markerClassName?: string;
  /**
   * ClassName applied to the indicator badge (background + border).
   * Defaults match current styling.
   */
  indicatorBadgeClassName?: string;
  /**
   * ClassName applied to the indicator minutes text.
   * Defaults match current styling.
   */
  indicatorMinutesClassName?: string;
  /**
   * ClassName applied to the indicator label above (vessel name).
   * Defaults match current styling.
   */
  indicatorLabelClassName?: string;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a horizontal progress bar that calculates progress automatically from time values.
 * The bar consists of a background track, a filled progress portion, circles at each end,
 * and optionally a progress indicator when active.
 *
 * Width is determined via FlexBox `flexGrow`, derived from the segment's time interval.
 * Current time is obtained from context.
 *
 * @param startTimeMs - Start time in milliseconds for progress calculation
 * @param endTimeMs - End time in milliseconds for progress calculation
 * @param status - Status of the progress bar segment (default "Pending")
 * @param vesselName - Optional vessel name to display above the indicator when in progress
 * @param circleSize - Size of the circle markers in pixels (default 20)
 * @param barHeight - Height of the progress bar in pixels (default 12)
 * @param className - Additional CSS classes for styling
 * @param style - Additional inline styles
 * @returns A View containing the progress bar with circles and optional indicator
 */
const TimelineBar = ({
  startTimeMs,
  endTimeMs,
  status,
  vesselName,
  circleSize = 20,
  barHeight = 12,
  trackClassName,
  fillClassName,
  markerClassName,
  indicatorBadgeClassName,
  indicatorMinutesClassName,
  indicatorLabelClassName,
  className,
  style,
}: TimelineBarProps) => {
  const nowMs = useTripProgressTime();

  // Calculate progress
  const progress = calculateTimeProgress({
    status,
    nowMs,
    startTimeMs,
    endTimeMs,
  });

  // InProgress bars have higher z-index
  // Lower numbers render behind higher numbers. On Android, we also map this to
  // `elevation` to ensure consistent stacking.
  const isActive = status === "InProgress";
  const effectiveZIndex = isActive ? 40 : 10;

  // Calculate minutes remaining. Undefined means unknown, and will display as "--".
  const minutesRemaining = getMinutesRemaining({ nowMs, endTimeMs });

  const durationFlexGrow = getFlexGrowFromTimeIntervalMs(
    startTimeMs,
    endTimeMs
  );
  const effectiveFlexGrow =
    typeof style?.flexGrow === "number" ? style.flexGrow : durationFlexGrow;

  return (
    <View
      className={cn("relative", className)}
      style={{
        overflow: "visible",
        zIndex: effectiveZIndex,
        elevation: effectiveZIndex,
        flexGrow: effectiveFlexGrow,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: "15%",
        ...style,
      }}
    >
      <TimelineBarEndpoints
        circleSize={circleSize}
        markerClassName={markerClassName}
        zIndex={effectiveZIndex}
      />
      <TimelineBarTrack
        progress={progress}
        barHeight={barHeight}
        trackClassName={trackClassName}
        fillClassName={fillClassName}
      />
      {isActive && (
        <TimelineIndicator
          progress={progress}
          minutesRemaining={minutesRemaining}
          labelAbove={
            vesselName ? (
              <Text
                className={cn("text-sm font-semibold", indicatorLabelClassName)}
                style={{ flexShrink: 0 }}
              >
                {vesselName}
              </Text>
            ) : undefined
          }
          badgeClassName={indicatorBadgeClassName}
          minutesClassName={indicatorMinutesClassName}
        />
      )}
    </View>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a time interval into a flexGrow value.
 * Uses minutes to keep numbers small while preserving ratios.
 *
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns flexGrow value (>= 1)
 */
const getFlexGrowFromTimeIntervalMs = (
  startTimeMs?: number,
  endTimeMs?: number
): number => {
  if (startTimeMs === undefined || endTimeMs === undefined) {
    return 1;
  }

  const durationMs = endTimeMs - startTimeMs;
  if (durationMs <= 0) {
    return 1;
  }

  const minutes = Math.round(durationMs / (1000 * 60));
  return Math.max(1, minutes);
};

export default TimelineBar;
