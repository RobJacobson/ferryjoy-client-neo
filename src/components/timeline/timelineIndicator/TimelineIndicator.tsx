/**
 * Composes banner, circle, and optional radar ping for the active timeline dot.
 */

import type { ComponentRef, RefObject } from "react";
import type { ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { View as UIView } from "@/components/ui";
import { View } from "@/components/ui";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TIMELINE_SHARED_CONFIG } from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineActiveIndicator } from "../types";
import { useAnimatedProgress } from "../useAnimatedProgress";
import { useRockingAnimation } from "../useRockingAnimation";
import { TimelineIndicatorBanner } from "./TimelineIndicatorBanner";
import { TimelineIndicatorCircle } from "./TimelineIndicatorCircle";
import { TimelineIndicatorRadarPing } from "./TimelineIndicatorRadarPing";

type TimelineIndicatorProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  topPx: number;
  overlayIndicator: TimelineActiveIndicator;
  sizePx?: number;
  theme: TimelineVisualTheme;
};

/**
 * Absolutely positioned indicator with vertical motion and optional rocking.
 *
 * @param blurTargetRef - Blur sampling target for glass child surfaces
 * @param topPx - Desired top offset before animated smoothing
 * @param overlayIndicator - Active indicator copy and motion state
 * @param sizePx - Width and height of the circular indicator
 * @param theme - Indicator colors and ping styling
 * @returns Animated indicator subtree aligned to the track column
 */
export const TimelineIndicator = ({
  blurTargetRef,
  topPx,
  overlayIndicator,
  sizePx = TIMELINE_SHARED_CONFIG.indicatorSizePx,
  theme,
}: TimelineIndicatorProps) => {
  const progress = useAnimatedProgress(topPx);
  const rockingStyle = useRockingAnimation(
    overlayIndicator.animate ?? false,
    overlayIndicator.speedKnots ?? 0
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: progress.value,
    };
  }, [progress]);

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: `${TIMELINE_SHARED_CONFIG.trackXPositionPercent}%`,
        },
        animatedStyle,
        rockingStyle,
      ]}
    >
      <TimelineIndicatorBanner
        blurTargetRef={blurTargetRef}
        title={overlayIndicator.title}
        subtitle={overlayIndicator.subtitle}
        sizePx={sizePx}
        theme={theme}
      />
      <View style={getBadgeAnchorStyle(sizePx)}>
        <TimelineIndicatorRadarPing sizePx={sizePx} theme={theme} />
        <TimelineIndicatorCircle
          blurTargetRef={blurTargetRef}
          label={overlayIndicator.label}
          sizePx={sizePx}
          theme={theme}
        />
      </View>
    </Animated.View>
  );
};

const getBadgeAnchorStyle = (sizePx: number): ViewStyle => ({
  top: 0,
  left: 0,
  ...getAbsoluteCenteredBoxStyle({
    width: sizePx,
    height: sizePx,
  }),
});
