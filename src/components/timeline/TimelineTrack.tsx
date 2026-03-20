/**
 * Shared full-height timeline track component.
 */

import type { ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { View } from "@/components/ui";
import {
  TIMELINE_INDICATOR_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "./config";
import {
  BASE_TIMELINE_VISUAL_THEME,
  TIMELINE_RENDER_CONSTANTS,
  type TimelineVisualTheme,
} from "./theme";

const TIMELINE_TRACK_GLOW_PULSE_DURATION_MS = 7000;

type TimelineTrackProps = {
  containerHeightPx: number;
  completedPercent: number;
  theme?: TimelineVisualTheme;
};

export const TimelineTrack = ({
  containerHeightPx,
  completedPercent,
  theme = BASE_TIMELINE_VISUAL_THEME,
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
        left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
        width: TIMELINE_INDICATOR_SIZE_PX,
        height: containerHeightPx,
        marginLeft: -TIMELINE_INDICATOR_SIZE_PX / 2,
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
              backgroundColor: theme.track.completedGlowColor,
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

const createTrackGlowPulseStyle = (): ViewStyle => ({
  animationName: {
    "0%": {
      opacity: 0.25,
    },
    "50%": {
      opacity: 1,
    },
    "100%": {
      opacity: 0.25,
    },
  },
  animationDuration: TIMELINE_TRACK_GLOW_PULSE_DURATION_MS,
  animationDelay: 0,
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-in-out",
});
