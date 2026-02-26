/**
 * TimelineBarAtDock component for rendering at-dock segments with time-based progress.
 * Calculates progress automatically based on current time and start/end times.
 * Handles at-dock status labels.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { ViewStyle } from "react-native";
import { Text } from "@/components/ui";
import { useNowMs } from "@/shared/hooks";
import { useAnimatedProgress } from "./hooks/useAnimatedProgress";
import TimelineBar from "./TimelineBar";
import { TimelineBlock } from "./TimelineBlock";
import TimelineIndicator from "./TimelineIndicator";
import type { AtDockSegment } from "./types";
import { getTimelineLayout } from "./utils";
import { getDockBarStatus } from "./utils/segmentBlockHelpers";

type TimelineBarAtDockProps = {
  segment: AtDockSegment;
  vesselLocation?: VesselLocation;
  barStyle?: string;
  style?: ViewStyle;
  /**
   * Orientation of the timeline.
   * Defaults to "horizontal".
   */
  orientation?: "horizontal" | "vertical";
};

/**
 * A component that renders an at-dock progress segment with time-based progress.
 *
 * @param segment - AtDockSegment with arriveCurr, leaveCurr, phase
 * @param vesselLocation - Real-time vessel location for indicator content
 * @param barStyle - Optional bar styling
 * @param style - Optional container style
 * @param orientation - Orientation of the timeline (default "horizontal")
 */
const TimelineBarAtDock = ({
  segment,
  vesselLocation,
  barStyle = "h-3",
  style,
  orientation = "horizontal",
}: TimelineBarAtDockProps) => {
  const startTimeMs = segment.arriveCurr.scheduled.getTime();
  const endTimeMs = segment.leaveCurr.scheduled.getTime();
  const status = getDockBarStatus(segment);
  const predictionEndTimeMs = segment.leaveCurr.estimated?.getTime();
  const showIndicator = segment.phase === "at-dock";
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
  const animatedProgress = useAnimatedProgress(progress);

  const shouldShowIndicator =
    showIndicator ??
    (status === "InProgress" && segment.isArrived && !segment.isHeld);

  return (
    <TimelineBlock
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
            <Text className="font-playpen-600 text-sm">
              {vesselLocation.VesselName}
            </Text>
          )}
          {vesselLocation?.DepartingTerminalAbbrev && (
            <Text className="font-playpen-300 text-muted-foreground text-sm leading-[1.15]">
              At Dock {vesselLocation.DepartingTerminalAbbrev}
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineBlock>
  );
};

export default TimelineBarAtDock;
