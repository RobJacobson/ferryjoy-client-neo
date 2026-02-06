/**
 * TimelineBarAtSea component for rendering at-sea trip segments with distance-based progress.
 * Calculates progress based on departing and arriving distances.
 * Handles rocking animation for at-sea segments.
 */

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

type TimelineBarAtSeaProps = {
  startTimeMs?: number;
  endTimeMs?: number;
  status: TimelineSegmentStatus;
  predictionEndTimeMs?: number;
  isArrived?: boolean;
  isHeld?: boolean;
  departingDistance?: number;
  arrivingDistance?: number;
  vesselName?: string;
  speed?: number;
  circleSize?: number;
  barStyle?: string;
  showIndicator?: boolean;
  animate?: boolean;
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * A component that renders an at-sea progress segment with distance-based progress.
 * Calculates all business logic (progress, duration) and renders
 * using the presentation-only TimelineBar and TimelineIndicator components.
 * The TimelineBar and TimelineIndicator are siblings to allow proper z-index stacking.
 *
 * Width allocation: Uses SchematicSegment (flexGrow + minWidth) to create
 * proportional widths across the timeline while ensuring legibility.
 *
 * Hold period: When isArrived is true, the indicator remains visible during
 * the 30-second hold period, showing "0 min" remaining instead of speed/distance.
 */
const TimelineBarAtSea = ({
  startTimeMs,
  endTimeMs,
  status,
  predictionEndTimeMs,
  isArrived = false,
  isHeld = false,
  departingDistance,
  arrivingDistance,
  vesselName,
  speed = 0,
  barStyle = "h-3",
  showIndicator,
  animate = false,
  style,
}: TimelineBarAtSeaProps) => {
  const nowMs = useNowMs(1000);

  const animatedProgress = useSharedValue(0);

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

  let progress = timeProgress;
  if (isArrived || isHeld) {
    progress = 1;
  } else if (
    status === "InProgress" &&
    departingDistance !== undefined &&
    arrivingDistance !== undefined &&
    departingDistance + arrivingDistance > 0
  ) {
    progress = departingDistance / (departingDistance + arrivingDistance);
    progress = Math.min(1, Math.max(0, progress));
  }

  useEffect(() => {
    animatedProgress.value = withSpring(progress, {
      damping: 100,
      stiffness: 2,
      mass: 5,
      overshootClamping: true,
    });
  }, [progress, animatedProgress]);

  const shouldShowIndicator =
    showIndicator ?? (status === "InProgress" || isArrived || isHeld);

  return (
    <TimelineSegment duration={duration ?? 1} style={style}>
      <TimelineBar flexGrow={1} progress={progress} barStyle={barStyle} />
      {shouldShowIndicator && (
        <TimelineIndicator
          progress={animatedProgress}
          minutesRemaining={minutesRemaining ?? "--"}
          animate={animate}
          speed={speed}
        >
          {vesselName && (
            <Text className="text-sm font-bold leading-none font-playwrite pt-4">
              {vesselName}
            </Text>
          )}
          {!isArrived && arrivingDistance !== undefined && (
            <Text className="text-xs text-muted-foreground font-playwrite-light">
              {speed.toFixed(0)} kn · {arrivingDistance.toFixed(1)} mi
            </Text>
          )}
          {isArrived && (
            <Text className="text-xs text-muted-foreground font-playwrite-light">
              Arrived ❤️❤️❤️
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineSegment>
  );
};

export default TimelineBarAtSea;
