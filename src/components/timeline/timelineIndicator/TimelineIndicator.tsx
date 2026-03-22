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
  theme: TimelineVisualTheme;
};

type RenderIndicatorContentParams = Pick<
  TimelineIndicatorProps,
  "blurTargetRef" | "label" | "title" | "subtitle" | "theme"
> & {
  sizePx: number;
};

const BANNER_MAX_WIDTH_PX = 400;

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
  theme,
}: TimelineIndicatorProps) => {
  const progress = useAnimatedProgress(topPx);
  const rockingStyle = useRockingAnimation(animate, speedKnots);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: progress.value,
    };
  }, [progress]);

  const contentParams = {
    blurTargetRef,
    label,
    title,
    subtitle,
    sizePx,
    theme,
  };

  return (
    <Animated.View
      style={[
        { position: "absolute", left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%` },
        animatedStyle,
        rockingStyle,
      ]}
    >
      {renderBanner(contentParams)}
      <View style={getBadgeAnchorStyle(sizePx)}>
        <TimelineIndicatorRadarPing sizePx={sizePx} theme={theme} />
        {renderBadge(contentParams)}
      </View>
    </Animated.View>
  );
};

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx / 2 - 6,
  left: -BANNER_MAX_WIDTH_PX / 2,
  width: BANNER_MAX_WIDTH_PX,
});

const getBadgeAnchorStyle = (sizePx: number): ViewStyle => ({
  top: 0,
  left: 0,
  ...getAbsoluteCenteredBoxStyle({
    width: sizePx,
    height: sizePx,
  }),
});

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

const renderBanner = ({
  blurTargetRef,
  title,
  subtitle,
  sizePx,
  theme,
}: RenderIndicatorContentParams) => {
  if (!title && !subtitle) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute items-center"
      style={getBannerStyle(sizePx)}
    >
      <IndicatorGlass
        blurTargetRef={blurTargetRef}
        theme={theme}
        style={{ maxWidth: BANNER_MAX_WIDTH_PX }}
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
  );
};

const renderBadge = ({
  blurTargetRef,
  label,
  sizePx,
  theme,
}: RenderIndicatorContentParams) => (
  <IndicatorGlass
    blurTargetRef={blurTargetRef}
    theme={theme}
    className="absolute"
    style={{ width: sizePx, height: sizePx }}
    contentClassName="h-full w-full items-center justify-center"
  >
    <Text
      className="font-playpen-600"
      style={{ color: theme.indicator.badgeLabelColor }}
    >
      {label}
    </Text>
  </IndicatorGlass>
);
