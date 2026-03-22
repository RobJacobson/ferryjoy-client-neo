/**
 * Composes badge, banner, and optional radar ping for the active timeline dot.
 */

import { BlurView } from "expo-blur";
import type { ComponentRef, ReactNode, RefObject } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { View as UIView } from "@/components/ui";
import { Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import {
  TIMELINE_INDICATOR_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "../theme";
import { useAnimatedProgress } from "../useAnimatedProgress";
import { useRockingAnimation } from "../useRockingAnimation";
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
  theme: TimelineVisualTheme;
};

type IndicatorGlassProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  className?: string;
  style?: StyleProp<ViewStyle>;
  contentClassName?: string;
  children: ReactNode;
  theme: TimelineVisualTheme;
};

const IndicatorGlass = ({
  blurTargetRef,
  className,
  style,
  contentClassName,
  children,
  theme,
}: IndicatorGlassProps) => (
  <View
    style={[
      style,
      {
        borderWidth: 1,
        borderColor: theme.indicator.borderColor,
      },
    ]}
    className={cn("overflow-hidden rounded-full", className)}
    pointerEvents="none"
  >
    <BlurView
      blurTarget={blurTargetRef}
      intensity={TIMELINE_RENDER_CONSTANTS.indicator.glassBlurIntensity}
      tint="light"
      blurMethod="dimezisBlurView"
      className="absolute inset-0"
    />
    <View className="absolute inset-0 bg-white/50" />
    <View className={contentClassName}>{children}</View>
  </View>
);

/**
 * Absolutely positioned indicator with vertical motion and optional rocking.
 *
 * @param blurTargetRef - Blur sampling target for glass child surfaces
 * @param topPx - Desired top offset before animated smoothing
 * @param label - Short badge text (e.g. vessel or status)
 * @param title - Optional banner title
 * @param subtitle - Optional banner subtitle
 * @param animate - When true, applies speed-based rocking
 * @param speedKnots - Speed input for rocking cadence
 * @param sizePx - Width and height of the circular indicator
 * @param showRadarPing - Toggles the expanding ping ring
 * @param theme - Indicator colors and ping styling
 * @returns Animated indicator subtree aligned to the track column
 */
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
  theme,
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
      {title || subtitle ? (
        <View
          pointerEvents="none"
          className="absolute items-center"
          style={getBannerStyle(sizePx)}
        >
          <IndicatorGlass
            blurTargetRef={blurTargetRef}
            theme={theme}
            contentClassName="items-center px-4 py-1"
          >
            {title ? (
              <Text
                className="text-center font-playpen-600 leading-tight"
                style={{ color: theme.indicator.bannerTitleColor }}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text
                className="text-center font-playpen-300 text-sm leading-tight"
                style={{ color: theme.indicator.bannerSubtitleColor }}
              >
                {subtitle}
              </Text>
            ) : null}
          </IndicatorGlass>
        </View>
      ) : null}
      <IndicatorGlass
        blurTargetRef={blurTargetRef}
        theme={theme}
        className="absolute"
        style={getBadgeStyle(sizePx)}
        contentClassName="h-full w-full items-center justify-center"
      >
        <Text
          className="font-playpen-600"
          style={{ color: theme.indicator.badgeLabelColor }}
        >
          {label}
        </Text>
      </IndicatorGlass>
    </Animated.View>
  );
};

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx - 6,
  left: "50%",
  width: 200,
  marginLeft: -100,
});

const getBadgeStyle = (sizePx: number): ViewStyle => ({
  left: "50%",
  width: sizePx,
  height: sizePx,
  marginLeft: -sizePx / 2,
});
