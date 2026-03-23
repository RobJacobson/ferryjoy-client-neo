/**
 * Keyframes and layout for the timeline indicator radar ping animation.
 */

import type { ViewStyle } from "react-native";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";

const TIMELINE_INDICATOR_RADAR_PING_DURATION_MS = 10000;

type RadarPingStyleConfig = {
  pingColor: string;
};

/**
 * Builds opacity and scale keyframes for one ping cycle.
 *
 * @returns Reanimated-compatible animation fragment for the ping view
 */
const createRadarPingAnimationStyle = (): ViewStyle => ({
  animationName: {
    "0%": {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    "49.99%": {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    "50%": {
      opacity: 1,
      transform: [{ scale: 1 }],
    },
    "100%": {
      opacity: 0,
      transform: [{ scale: 2.5 }],
    },
  },
  animationDuration: TIMELINE_INDICATOR_RADAR_PING_DURATION_MS,
  animationDelay: 0,
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-out",
});

/**
 * Combines geometry, colors, and animation for the radar ping layer.
 *
 * @param ping - Theme ping section (border width and color)
 * @param sizePx - Outer indicator size used to size the ring
 * @returns Style object for `Animated.View` including animation fields
 */
export const getTimelineIndicatorRadarPingStyle = (
  ping: RadarPingStyleConfig,
  sizePx: number
): ViewStyle => {
  return {
    left: "50%",
    top: "50%",
    ...getAbsoluteCenteredBoxStyle({
      width: sizePx,
      height: sizePx,
    }),
    borderRadius: sizePx / 2,
    borderWidth: 2,
    borderColor: ping.pingColor,
    ...createRadarPingAnimationStyle(),
  };
};

export const getTimelineIndicatorRadarPingFillStyle = (
  pingColor: string,
  sizePx: number
): ViewStyle => ({
  position: "absolute",
  inset: 0,
  borderRadius: sizePx / 2,
  backgroundColor: pingColor,
  opacity: 0.5,
});
