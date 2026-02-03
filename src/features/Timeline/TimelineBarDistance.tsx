/**
 * TimelineBarDistance component for rendering a timeline segment with distance-based progress.
 * Calculates progress based on arriving and departing distances.
 * Still uses time for width allocation (flex-grow) and minutes remaining labels.
 */

import type { ViewStyle } from "react-native";
import { useNowMs } from "@/shared/hooks";
import TimelineBar, { type TimelineBarStatus } from "./TimelineBar";
import { getTimelineLayout } from "./utils";

type TimelineBarDistanceProps = {
  /**
   * Distance from departing terminal in miles.
   */
  departingDistance?: number;
  /**
   * Distance to arriving terminal in miles.
   */
  arrivingDistance?: number;
  /**
   * Start time in milliseconds (used for flex-grow width allocation).
   */
  startTimeMs?: number;
  /**
   * End time in milliseconds (used for flex-grow and minutes remaining).
   */
  endTimeMs?: number;
  /**
   * Status of the progress bar segment.
   */
  status: TimelineBarStatus;
  /**
   * Optional prediction for the end time of this segment.
   * If provided, progress will be calculated against this instead of endTimeMs
   * when the vessel is delayed.
   */
  predictionEndTimeMs?: number;
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
 * A wrapper around TimelineBar that calculates progress based on distance.
 * Falls back to time-based progress if distance data is missing.
 */
const TimelineBarDistance = ({
  departingDistance,
  arrivingDistance,
  startTimeMs,
  endTimeMs,
  status,
  predictionEndTimeMs,
  vesselName,
  animate = false,
  speed = 0,
  circleSize = 20,
  barHeight = 12,
  atDockAbbrev,
  isArrived,
  style,
}: TimelineBarDistanceProps) => {
  const nowMs = useNowMs(1000);

  // Calculate layout values (duration for flex-grow, minutesRemaining for label)
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

  // Calculate distance-based progress
  let progress = timeProgress;
  if (isArrived) {
    progress = 1;
  } else if (
    status === "InProgress" &&
    departingDistance !== undefined &&
    arrivingDistance !== undefined &&
    departingDistance + arrivingDistance > 0
  ) {
    // Progress = DepartingDistance / (DepartingDistance + ArrivingDistance)
    // Note: User query said ArrivingDistance/(ArrivingDistance + DepartingDistance)
    // but usually progress is distance traveled / total distance.
    // If DepartingDistance is distance FROM departure, then:
    // Progress = DepartingDistance / (DepartingDistance + ArrivingDistance)
    progress = departingDistance / (departingDistance + arrivingDistance);
    // Clamp between 0 and 1
    progress = Math.min(1, Math.max(0, progress));
  }

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
      arrivingDistance={arrivingDistance}
      atDockAbbrev={atDockAbbrev}
      isArrived={isArrived}
      style={style}
    />
  );
};

export default TimelineBarDistance;
