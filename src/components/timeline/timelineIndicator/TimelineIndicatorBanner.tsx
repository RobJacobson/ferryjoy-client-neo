import type { ComponentRef, RefObject } from "react";
import type { ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text, View } from "@/components/ui";
import { TIMELINE_INDICATOR_CONFIG } from "../config";
import { TimelineGlassSurface } from "../TimelineGlassSurface";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "../theme";

export type TimelineIndicatorBannerProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  title?: string;
  subtitle?: string;
  sizePx: number;
  theme: TimelineVisualTheme;
};

const {
  borderWidthPx,
  maxWidthPx,
  verticalOffsetPx,
} = TIMELINE_INDICATOR_CONFIG.banner;

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx / 2 - verticalOffsetPx,
  left: -maxWidthPx / 2,
  width: maxWidthPx,
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
          maxWidth: maxWidthPx,
          borderWidth: borderWidthPx,
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
