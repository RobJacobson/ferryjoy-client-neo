import type { ComponentRef, RefObject } from "react";
import type { ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text, View } from "@/components/ui";
import { TimelineGlassSurface } from "../TimelineGlassSurface";
import {
  TIMELINE_RENDER_CONSTANTS,
  type TimelineVisualTheme,
} from "../theme";

const BANNER_MAX_WIDTH_PX = 400;

export type TimelineIndicatorBannerProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  title?: string;
  subtitle?: string;
  sizePx: number;
  theme: TimelineVisualTheme;
};

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx / 2 - 6,
  left: -BANNER_MAX_WIDTH_PX / 2,
  width: BANNER_MAX_WIDTH_PX,
});

export const TimelineIndicatorBanner = ({
  blurTargetRef,
  title,
  subtitle,
  sizePx,
  theme,
}: TimelineIndicatorBannerProps) => {
  if (!title && !subtitle) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute items-center"
      style={getBannerStyle(sizePx)}
    >
      <View
        pointerEvents="none"
        className="overflow-hidden rounded-full"
        style={{
          maxWidth: BANNER_MAX_WIDTH_PX,
          borderWidth: 2,
          borderColor: theme.glassBorderColor,
        }}
      >
        <TimelineGlassSurface
          blurTargetRef={blurTargetRef}
          blurIntensity={TIMELINE_RENDER_CONSTANTS.indicator.glassBlurIntensity}
          theme={theme}
          className="rounded-full"
        >
          <View className="items-center px-4 py-1">
            {title && (
              <Text
                className="text-center font-playpen-600 leading-tight"
                style={{ color: theme.text.indicatorHeadlineColor }}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                className="text-center font-playpen-300 text-sm leading-tight"
                style={{ color: theme.text.bodyColor }}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </TimelineGlassSurface>
      </View>
    </View>
  );
};
