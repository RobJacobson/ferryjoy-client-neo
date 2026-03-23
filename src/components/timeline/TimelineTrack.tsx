/**
 * Full-height vertical track with optional completed segment and glow pulse.
 */

import type { ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { View } from "@/components/ui";
import { TIMELINE_SHARED_CONFIG } from "./config";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "./theme";

const TIMELINE_TRACK_GLOW_PULSE_DURATION_MS = 7000;

type TimelineTrackProps = {
  containerHeightPx: number;
  completedPercent: number;
  theme: TimelineVisualTheme;
};

/**
 * Renders the timeline spine and a proportional "completed" fill above it.
 *
 * @param containerHeightPx - Total track height in pixels
 * @param completedPercent - Fraction of height filled (0–1)
 * @param theme - Track colors from the visual theme
 * @returns The track view, or null when height is non-positive
 */
export const TimelineTrack = ({
  containerHeightPx,
  completedPercent,
  theme,
}: TimelineTrackProps) => {
  if (containerHeightPx <= 0) {
    return null;
  }

  const trackWidthPx = TIMELINE_RENDER_CONSTANTS.track.coreWidthPx;
  const glowWidthPx = Math.max(
    trackWidthPx,
    TIMELINE_RENDER_CONSTANTS.track.glowWidthPx
  );
  const completedHeightPx = containerHeightPx * completedPercent;
  const glowPulseStyle = createTrackGlowPulseStyle();

  return (
    <View
      className="absolute items-center"
      pointerEvents="none"
      style={{
        left: `${TIMELINE_SHARED_CONFIG.trackXPositionPercent}%`,
        width: TIMELINE_SHARED_CONFIG.indicatorSizePx,
        height: containerHeightPx,
        marginLeft: -TIMELINE_SHARED_CONFIG.indicatorSizePx / 2,
      }}
    >
      <View
        className="absolute"
        style={{
          top: 0,
          width: trackWidthPx,
          height: containerHeightPx,
          borderRadius: trackWidthPx / 2,
          backgroundColor: theme.track.remainingColor,
        }}
      />
      {completedPercent > 0 ? (
        <View
          className="absolute items-center"
          style={{
            top: 0,
            width: glowWidthPx,
            height: completedHeightPx,
          }}
        >
          <Animated.View
            className="absolute"
            style={{
              top: 0,
              width: glowWidthPx,
              height: completedHeightPx,
              borderRadius: glowWidthPx / 2,
              backgroundColor: theme.track.completedColor,
              ...glowPulseStyle,
            }}
          />
          <View
            style={{
              top: 0,
              width: trackWidthPx,
              height: completedHeightPx,
              borderRadius: trackWidthPx / 2,
              backgroundColor: theme.track.completedColor,
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

/**
 * Keyframe style for the soft pulse on the completed segment glow layer.
 *
 * @returns Reanimated-compatible animation style for the glow `Animated.View`
 */
const createTrackGlowPulseStyle = (): ViewStyle => ({
  animationName: {
    "0%": {
      opacity: 0.025,
    },
    "50%": {
      opacity: 0.1,
    },
    "100%": {
      opacity: 0.025,
    },
  },
  animationDuration: TIMELINE_TRACK_GLOW_PULSE_DURATION_MS,
  animationDelay: 0,
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-in-out",
});
