/**
 * TimelineBar component for rendering individual progress segments in timeline meter.
 * Displays a horizontal progress bar that calculates progress based on numeric values.
 * Uses FlexBox flex-grow for proportional width allocation based on segment duration.
 * Used as a building block within TimelineMeter to create multi-segment progress visualizations.
 */

import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { LayoutAnimation, View } from "react-native";
import { Text } from "@/components/ui";
import { useNowMs } from "@/shared/hooks";
import { TimelineBarTrack } from "./TimelineBarTrack";
import TimelineIndicator from "./TimelineIndicator";
import TimelineMarker from "./TimelineMarker";
import { getTimelineLayout } from "./utils";

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
   * Whether to animate the progress indicator when at sea.
   */
  animate?: boolean;
  /**
   * Current speed of the vessel in knots.
   */
  speed?: number;
  /**
   * Size of the circle markers in pixels.
   */
  circleSize?: number;
  /**
   * Height of the progress bar in pixels.
   */
  barHeight?: number;
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a horizontal progress bar that calculates progress automatically from time values.
 * The bar consists of a background track, a filled progress portion, circles at each end,
 * and optionally a progress indicator when active.
 *
 * Width is determined via FlexBox `flexGrow`, derived from segment's time interval.
 * Current time is obtained from context.
 *
 * @param startTimeMs - Start time in milliseconds for progress calculation
 * @param endTimeMs - End time in milliseconds for progress calculation
 * @param status - Status of the progress bar segment (default "Pending")
 * @param vesselName - Optional vessel name to display above the indicator when in progress
 * @param animate - Whether to animate the progress indicator when at sea
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
  animate = false,
  speed = 0,
  circleSize = 20,
  barHeight = 12,
  style,
}: TimelineBarProps) => {
  const nowMs = useNowMs(1000);

  // Calculate layout and progress
  const { progress, minutesRemaining, duration } = getTimelineLayout({
    status,
    nowMs,
    startTimeMs,
    endTimeMs,
  });

  // InProgress bars have a higher stacking order to ensure they render on top
  // of adjacent segments (important for overlapping markers).
  // We use 2 and 3 because on Android, elevation also controls shadow size;
  // these values keep the shadow refined while enforcing the correct order.
  const isActive = status === "InProgress";
  const effectiveStacking = isActive ? 3 : 2;
  const flexGrow = style?.flexGrow ?? duration ?? 1;

  // Animate layout changes (like flexGrow/width) when they change
  // biome-ignore lint/correctness/useExhaustiveDependencies: animate the layout changes when flexGrow changes
  useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 1000,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
  }, [flexGrow]);

  return (
    <View
      className="relative flex-row items-center"
      style={{
        overflow: "visible",
        zIndex: effectiveStacking,
        elevation: effectiveStacking,
        flexGrow: flexGrow,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: "25%",
        height: circleSize, // Explicit height to provide vertical centering context
        ...style,
      }}
    >
      <TimelineMarker
        className="bg-white border border-pink-500"
        zIndex={effectiveStacking + 1}
        size={circleSize}
      />
      <TimelineBarTrack progress={progress} barHeight={barHeight} />
      <TimelineMarker
        className="bg-white border border-pink-500"
        zIndex={effectiveStacking + 1}
        size={circleSize}
      />
      {isActive && (
        <TimelineIndicator
          progress={progress}
          minutesRemaining={minutesRemaining}
          animate={animate}
          speed={speed}
          labelAbove={
            vesselName ? (
              <Text className="text-sm font-semibold" style={{ flexShrink: 0 }}>
                {vesselName}
              </Text>
            ) : undefined
          }
        />
      )}
    </View>
  );
};

export default TimelineBar;
