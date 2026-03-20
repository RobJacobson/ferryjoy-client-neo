import type { ComponentRef, RefObject } from "react";
import { View, type ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";
import { BASE_TIMELINE_VISUAL_THEME, type TimelineVisualTheme } from "../theme";
import { TimelineIndicatorGlass } from "./TimelineIndicatorGlass";

type TimelineIndicatorBannerProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  title?: string;
  subtitle?: string;
  sizePx: number;
  theme?: TimelineVisualTheme;
};

export const TimelineIndicatorBanner = ({
  blurTargetRef,
  title,
  subtitle,
  sizePx,
  theme = BASE_TIMELINE_VISUAL_THEME,
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
      <TimelineIndicatorGlass
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
      </TimelineIndicatorGlass>
    </View>
  );
};

const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx - 6,
  left: "50%",
  width: 200,
  marginLeft: -100,
});
