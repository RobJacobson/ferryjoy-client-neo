/**
 * TimelineBarAtSea component for rendering at-sea trip segments with distance-based progress.
 * Calculates progress based on departing and arriving distances.
 * Handles rocking animation for at-sea segments.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { Text } from "@/components/ui";
import { useNowMs } from "@/shared/hooks";
import TimelineBar from "./TimelineBar";
import { TimelineBlock } from "./TimelineBlock";
import TimelineIndicator from "./TimelineIndicator";
import type { AtSeaSegment } from "./types";
import { getTimelineLayout } from "./utils";
import {
  getSeaBarIsArrived,
  getSeaBarShowIndicator,
  getSeaBarStatus,
} from "./utils/segmentBlockHelpers";

type TimelineBarAtSeaProps = {
  segment: AtSeaSegment;
  vesselLocation?: VesselLocation;
  barStyle?: string;
  style?: ViewStyle;
};

/**
 * A component that renders an at-sea progress segment with distance-based progress.
 *
 * @param segment - AtSeaSegment with leaveCurr, arriveNext, phase
 * @param vesselLocation - Real-time vessel location for indicator content
 * @param barStyle - Optional bar styling
 * @param style - Optional container style
 */
const TimelineBarAtSea = ({
  segment,
  vesselLocation,
  barStyle = "h-3",
  style,
}: TimelineBarAtSeaProps) => {
  const startTimeMs = segment.leaveCurr.scheduled.getTime();
  const endTimeMs = segment.arriveNext.scheduled.getTime();
  const status = getSeaBarStatus(segment);
  const predictionEndTimeMs = segment.arriveNext.estimated?.getTime();
  const isArrived = getSeaBarIsArrived(segment);
  const showIndicator = getSeaBarShowIndicator(segment);
  const animate = segment.phase === "at-sea";
  const orientation = "horizontal";
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

  // Position indicator: end of segment when arrived, or when held after completion.
  let progress = timeProgress;
  if (isArrived) {
    progress = 1;
  } else if (segment.isHeld && status === "Completed") {
    progress = 1;
  } else if (
    status === "InProgress" &&
    vesselLocation?.DepartingDistance !== undefined &&
    vesselLocation?.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0
  ) {
    progress =
      vesselLocation.DepartingDistance /
      (vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance);
    progress = Math.min(1, Math.max(0, progress));
  }

  const animatedProgress = useSharedValue(progress);

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
    showIndicator ?? (status === "InProgress" || segment.isHeld);

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
          animate={animate}
          speed={vesselLocation?.Speed ?? 0}
        >
          {vesselLocation?.VesselName && (
            <Text className="font-playpen-600 text-sm">
              {vesselLocation.VesselName}
            </Text>
          )}
          {!isArrived && vesselLocation?.ArrivingDistance !== undefined && (
            <Text className="font-playpen-300 text-muted-foreground text-sm leading-[1.15]">
              {(vesselLocation?.Speed ?? 0).toFixed(0)} kn{" · "}
              {vesselLocation?.ArrivingDistance?.toFixed(1)} mi
            </Text>
          )}
          {isArrived && (
            <Text className="font-playpen-300 text-muted-foreground text-xs leading-[1.15]">
              ❤️ Arrived! ❤️
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineBlock>
  );
};

export default TimelineBarAtSea;
