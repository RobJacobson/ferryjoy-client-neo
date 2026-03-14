import { BlurView } from "expo-blur";
import type { RefObject } from "react";
import { type View as RNView, View, type ViewStyle } from "react-native";
import { Text } from "@/components/ui";
import { INDICATOR_STYLE } from "./theme";

type TimelineIndicatorBannerProps = {
  blurTargetRef: RefObject<RNView | null>;
  title?: string;
  subtitle?: string;
  sizePx: number;
};

export const TimelineIndicatorBanner = ({
  blurTargetRef,
  title,
  subtitle,
  sizePx,
}: TimelineIndicatorBannerProps) => {
  if (!title && !subtitle) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className={INDICATOR_STYLE.bannerContainerClassName}
      style={getBannerStyle(sizePx)}
    >
      <View className={INDICATOR_STYLE.bannerSurfaceClassName}>
        <BlurView
          blurTarget={blurTargetRef}
          intensity={INDICATOR_STYLE.blurIntensity}
          tint="light"
          blurMethod="dimezisBlurView"
          className={INDICATOR_STYLE.bannerBlurClassName}
        />
        <View className={INDICATOR_STYLE.bannerOverlayClassName} />
        <View className={INDICATOR_STYLE.bannerContentClassName}>
          {title ? (
            <Text className={INDICATOR_STYLE.bannerTitleClassName}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text className={INDICATOR_STYLE.bannerSubtitleClassName}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx + INDICATOR_STYLE.bannerOffsetPx,
  left: "50%",
  width: INDICATOR_STYLE.bannerWidthPx,
  marginLeft: -INDICATOR_STYLE.bannerWidthPx / 2,
});
