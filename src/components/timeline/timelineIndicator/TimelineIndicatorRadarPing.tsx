/**
 * Expanding radar-style ring behind the active timeline indicator.
 */

import Animated from "react-native-reanimated";
import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import {
  getTimelineIndicatorRadarPingFillStyle,
  getTimelineIndicatorRadarPingStyle,
} from "./timelineIndicatorRadarPingConfig";

type TimelineIndicatorRadarPingProps = {
  sizePx: number;
  theme: TimelineVisualTheme;
};

/**
 * Animated ping ring sized from the indicator diameter.
 *
 * @param sizePx - Outer indicator size used to derive ring diameter
 * @param theme - Ping border color and width
 * @returns Non-interactive animated view for the ping layer
 */
export const TimelineIndicatorRadarPing = ({
  sizePx,
  theme,
}: TimelineIndicatorRadarPingProps) => {
  const pingStyle = getTimelineIndicatorRadarPingStyle(
    { pingColor: theme.indicator.pingColor },
    sizePx
  );
  const pingFillStyle = getTimelineIndicatorRadarPingFillStyle(
    theme.indicator.pingColor,
    sizePx
  );

  return (
    <Animated.View pointerEvents="none" style={pingStyle}>
      <View pointerEvents="none" style={pingFillStyle} />
    </Animated.View>
  );
};
