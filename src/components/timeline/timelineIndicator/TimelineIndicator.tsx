/**
 * Shared animated timeline indicator orchestrator.
 */

import type { ComponentRef, RefObject } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { View as UIView } from "@/components/ui";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import {
  TIMELINE_INDICATOR_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import { BASE_TIMELINE_VISUAL_THEME, type TimelineVisualTheme } from "../theme";
import { useAnimatedProgress } from "../useAnimatedProgress";
import { useRockingAnimation } from "../useRockingAnimation";
import { TimelineIndicatorBadge } from "./TimelineIndicatorBadge";
import { TimelineIndicatorBanner } from "./TimelineIndicatorBanner";
import { TimelineIndicatorRadarPing } from "./TimelineIndicatorRadarPing";

type TimelineIndicatorProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  topPx: number;
  label: string;
  title?: string;
  subtitle?: string;
  animate?: boolean;
  speedKnots?: number;
  sizePx?: number;
  showRadarPing?: boolean;
  theme?: TimelineVisualTheme;
};

export const TimelineIndicator = ({
  blurTargetRef,
  topPx,
  label,
  title,
  subtitle,
  animate = false,
  speedKnots = 0,
  sizePx = TIMELINE_INDICATOR_SIZE_PX,
  showRadarPing = true,
  theme = BASE_TIMELINE_VISUAL_THEME,
}: TimelineIndicatorProps) => {
  const progress = useAnimatedProgress(topPx);
  const rockingStyle = useRockingAnimation(animate, speedKnots);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: progress.value,
    };
  }, [progress]);

  return (
    <Animated.View
      style={[
        getAbsoluteCenteredBoxStyle({
          width: sizePx,
          height: sizePx,
          isVertical: true,
        }),
        { left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%` },
        animatedStyle,
        rockingStyle,
      ]}
    >
      {showRadarPing ? (
        <TimelineIndicatorRadarPing sizePx={sizePx} theme={theme} />
      ) : null}
      <TimelineIndicatorBanner
        blurTargetRef={blurTargetRef}
        title={title}
        subtitle={subtitle}
        sizePx={sizePx}
        theme={theme}
      />
      <TimelineIndicatorBadge
        blurTargetRef={blurTargetRef}
        label={label}
        sizePx={sizePx}
        theme={theme}
      />
    </Animated.View>
  );
};
