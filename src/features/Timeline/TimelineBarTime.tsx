/**
 * TimelineBarTime component for rendering a timeline segment with time-based progress.
 * Calculates progress automatically based on current time and start/end times.
 */

import type { ViewStyle } from "react-native";
import { useNowMs } from "@/shared/hooks";
import TimelineBar, { type TimelineBarStatus } from "./TimelineBar";
import { getTimelineLayout } from "./utils";

type TimelineBarTimeProps = {
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
   */
  status: TimelineBarStatus;
  /**
   * Optional vessel name to display above the progress indicator.
   */
  vesselName?: string;
  /**
   * Whether to animate the progress indicator.
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
  /**
   * Optional terminal abbreviation to display when at dock (e.g., "At Dock SEA").
   */
  atDockAbbrev?: string;
  /**
   * Whether the vessel has arrived at its destination terminal.
   */
  isArrived?: boolean;
  style?: ViewStyle;
};

/**
 * A wrapper around TimelineBar that calculates progress based on time.
 */
const TimelineBarTime = ({
  startTimeMs,
  endTimeMs,
  status,
  vesselName,
  animate = false,
  speed = 0,
  circleSize = 20,
  barHeight = 12,
  atDockAbbrev,
  isArrived,
  style,
}: TimelineBarTimeProps) => {
  const nowMs = useNowMs(1000);

  // Calculate layout and progress
  const {
    progress: timeProgress,
    minutesRemaining,
    duration,
  } = getTimelineLayout({
    status,
    nowMs,
    startTimeMs,
    endTimeMs,
  });

  const progress = isArrived ? 1 : timeProgress;

  return (
    <TimelineBar
      progress={progress}
      duration={duration}
      minutesRemaining={minutesRemaining}
      status={status}
      vesselName={vesselName}
      animate={animate}
      speed={speed}
      circleSize={circleSize}
      barHeight={barHeight}
      atDockAbbrev={atDockAbbrev}
      isArrived={isArrived}
      style={style}
    />
  );
};

export default TimelineBarTime;
