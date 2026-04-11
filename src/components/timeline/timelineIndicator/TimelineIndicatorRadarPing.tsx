/**
 * Expanding radar-style ring behind the active timeline indicator (keyframes,
 * layout, and view).
 */

import type { ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { View } from "@/components/ui";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import type { TimelineVisualTheme } from "../theme";

const RADAR_PING_CONFIG = {
  durationMs: 5000,
  borderWidthPx: 3,
  fillOpacity: 0.5,
  opacityStart: 0.25,
  maxScale: 3,
} as const;

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
  const { ring, fill } = buildRadarPingStyles(theme.indicatorColor, sizePx);

  return (
    <Animated.View pointerEvents="none" style={ring}>
      <View pointerEvents="none" style={fill} />
    </Animated.View>
  );
};

/**
 * Opacity and scale keyframes for one radar ping cycle.
 *
 * @returns Reanimated-compatible animation fragment for the ping ring
 */
const radarPingKeyframeAnimation = (): ViewStyle => ({
  animationName: {
    0: {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    0.3999: {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    0.4: {
      opacity: RADAR_PING_CONFIG.opacityStart,
      transform: [{ scale: 1 }],
    },
    1: {
      opacity: 0,
      transform: [{ scale: RADAR_PING_CONFIG.maxScale }],
    },
  },
  animationDuration: RADAR_PING_CONFIG.durationMs,
  animationDelay: 0,
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-out",
});

/**
 * Produces ring and fill styles for one ping color and size.
 *
 * @param pingColor - Theme indicator color for border and fill tint
 * @param sizePx - Outer diameter in pixels
 * @returns Style pair for the animated ring and inner fill
 */
const buildRadarPingStyles = (
  pingColor: string,
  sizePx: number
): { fill: ViewStyle; ring: ViewStyle } => ({
  ring: {
    left: "50%",
    top: "50%",
    ...getAbsoluteCenteredBoxStyle({
      width: sizePx,
      height: sizePx,
    }),
    borderRadius: sizePx / 2,
    borderWidth: RADAR_PING_CONFIG.borderWidthPx,
    borderColor: pingColor,
    ...radarPingKeyframeAnimation(),
  },
  fill: {
    position: "absolute",
    inset: 0,
    borderRadius: sizePx / 2,
    backgroundColor: pingColor,
    opacity: RADAR_PING_CONFIG.fillOpacity,
  },
});
