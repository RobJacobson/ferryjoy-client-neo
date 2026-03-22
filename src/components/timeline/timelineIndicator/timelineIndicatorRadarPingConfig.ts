/**
 * Keyframes and layout for the timeline indicator radar ping animation.
 */

import type { ViewStyle } from "react-native";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";

export const TIMELINE_INDICATOR_RADAR_PING_DURATION_MS = 10000;

type RadarPingStyleConfig = {
  insetPx: number;
  borderWidth: number;
  peakOpacity: number;
  borderColor: string;
  fillColor?: string;
};

/**
 * Builds opacity and scale keyframes for one ping cycle.
 *
 * @param peakOpacity - Maximum opacity at mid-cycle before fade-out
 * @returns Reanimated-compatible animation fragment for the ping view
 */
const createRadarPingAnimationStyle = (peakOpacity: number): ViewStyle => ({
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
      opacity: peakOpacity,
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
 * @param ping - Theme ping section (inset, border, fill, peak opacity)
 * @param sizePx - Outer indicator size used to size the ring
 * @returns Style object for `Animated.View` including animation fields
 */
export const getTimelineIndicatorRadarPingStyle = (
  ping: RadarPingStyleConfig,
  sizePx: number
): ViewStyle => {
  const pingSizePx = Math.max(0, sizePx - ping.insetPx * 2);

  return {
    left: "50%",
    top: "50%",
    ...getAbsoluteCenteredBoxStyle({
      width: pingSizePx,
      height: pingSizePx,
    }),
    borderRadius: pingSizePx / 2,
    borderWidth: ping.borderWidth,
    borderColor: ping.borderColor,
    backgroundColor: ping.fillColor,
    ...createRadarPingAnimationStyle(ping.peakOpacity),
  };
};
