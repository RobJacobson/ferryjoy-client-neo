/**
 * TimelineBarAtDock component for rendering at-dock segments with time-based progress.
 * Calculates progress automatically based on current time and start/end times.
 * Handles at-dock status labels.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { Text } from "@/components/ui";
import { useNowMs } from "@/shared/hooks";
import TimelineBar from "./TimelineBar";
import TimelineIndicator from "./TimelineIndicator";
import { TimelineSegment } from "./TimelineSegment";
import type { TimelineSegmentStatus } from "./types";
import { getTimelineLayout } from "./utils";

// ============================================================================
// Types
// ============================================================================

type TimelineBarAtDockProps = {
  startTimeMs?: number;
  endTimeMs?: number;
  status: TimelineSegmentStatus;
  predictionEndTimeMs?: number;
  isArrived?: boolean;
  isHeld?: boolean;
  vesselLocation?: VesselLocation;
  circleSize?: number;
  orientation?: "horizontal" | "vertical";
  barStyle?: string;
  showIndicator?: boolean;
  style?: ViewStyle;
};

/**
 * A component that renders an at-dock progress segment with time-based progress.
 * Calculates all business logic (progress, duration, what labels to show) and renders
 * using the presentation-only TimelineBar and TimelineIndicator components.
 * The TimelineBar and TimelineIndicator are siblings to allow proper z-index stacking.
 *
 * Width allocation: Uses SchematicSegment (flexGrow + minWidth) to create
 * proportional widths across the timeline while ensuring legibility.
 */
const TimelineBarAtDock = ({
  startTimeMs,
  endTimeMs,
  status,
  predictionEndTimeMs,
  isArrived = false,
  isHeld = false,
  vesselLocation,
  orientation = "horizontal",
  barStyle = "h-3",
  showIndicator,
  style,
}: TimelineBarAtDockProps) => {
  const nowMs = useNowMs(1000);

  const {
    progress: timeProgress,
    minutesRemaining,
    duration,
  } = getTimelineLayout({
    status,
    nowMs,
    startTimeMs,
    endTimeMs,
    predictionEndTimeMs,
  });

  const progress = timeProgress;

  const animatedProgress = useSharedValue(progress);

  // Update the animated value whenever the progress prop changes
  useEffect(() => {
    // If progress is 1 or 0, we jump immediately without spring to avoid initial animation glitch
    if (progress === 1 || progress === 0) {
      animatedProgress.value = progress;
    } else {
      animatedProgress.value = withSpring(progress, {
        damping: 100,
        stiffness: 2,
        mass: 5,
        overshootClamping: true,
      });
    }
  }, [progress, animatedProgress]);

  const shouldShowIndicator =
    showIndicator ?? (status === "InProgress" && isArrived && !isHeld);

  return (
    <TimelineSegment
      duration={duration ?? 1}
      orientation={orientation}
      style={style}
    >
      <TimelineBar
        flexGrow={1}
        progress={progress}
        orientation={orientation}
        barStyle={barStyle}
      />
      {shouldShowIndicator && (
        <TimelineIndicator
          progress={animatedProgress}
          orientation={orientation}
          minutesRemaining={minutesRemaining ?? "--"}
        >
          {vesselLocation?.VesselName && (
            <Text className="text-sm font-playpen-600">
              {vesselLocation.VesselName}
            </Text>
          )}
          {vesselLocation?.DepartingTerminalAbbrev && (
            <Text className="text-sm text-muted-foreground font-playpen-300 leading-[1.15]">
              At Dock {vesselLocation.DepartingTerminalAbbrev}
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineSegment>
  );
};

export default TimelineBarAtDock;
