/**
 * Keyframes and layout for the timeline indicator radar ping animation.
 */

import type { ViewStyle } from "react-native";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TIMELINE_INDICATOR_CONFIG } from "../config";

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
    [TIMELINE_INDICATOR_CONFIG.radarPing.keyframes.hiddenStartPercent]: {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    [TIMELINE_INDICATOR_CONFIG.radarPing.keyframes.hiddenEndPercent]: {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    [TIMELINE_INDICATOR_CONFIG.radarPing.keyframes.visibleStartPercent]: {
      opacity: 1,
      transform: [{ scale: 1 }],
    },
    [TIMELINE_INDICATOR_CONFIG.radarPing.keyframes.endPercent]: {
      opacity: 0,
      transform: [{ scale: TIMELINE_INDICATOR_CONFIG.radarPing.maxScale }],
    },
  },
  animationDuration: TIMELINE_INDICATOR_CONFIG.radarPing.durationMs,
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
    borderWidth: TIMELINE_INDICATOR_CONFIG.radarPing.borderWidthPx,
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
  opacity: TIMELINE_INDICATOR_CONFIG.radarPing.fillOpacity,
});
