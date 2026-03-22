/**
 * Expanding radar-style ring behind the active timeline indicator.
 */

import Animated from "react-native-reanimated";
import type { TimelineVisualTheme } from "../theme";
import { getTimelineIndicatorRadarPingStyle } from "./timelineIndicatorRadarPingConfig";

type TimelineIndicatorRadarPingProps = {
  sizePx: number;
  theme: TimelineVisualTheme;
};

/**
 * Animated ping ring sized from the indicator diameter and theme insets.
 *
 * @param sizePx - Outer indicator size used to derive ring diameter
 * @param theme - Ping border, fill, and animation peak opacity
 * @returns Non-interactive animated view for the ping layer
 */
export const TimelineIndicatorRadarPing = ({
  sizePx,
  theme,
}: TimelineIndicatorRadarPingProps) => {
  const pingStyle = getTimelineIndicatorRadarPingStyle(
    theme.indicator.ping,
    sizePx
  );

  return <Animated.View pointerEvents="none" style={pingStyle} />;
};
