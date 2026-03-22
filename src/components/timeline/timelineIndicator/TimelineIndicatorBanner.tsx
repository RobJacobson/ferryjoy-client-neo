/**
 * Optional title and subtitle stack above the indicator badge.
 */

import type { ComponentRef, RefObject } from "react";
import { View, type ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import { TimelineIndicatorGlass } from "./TimelineIndicatorGlass";

type TimelineIndicatorBannerProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  title?: string;
  subtitle?: string;
  sizePx: number;
  theme: TimelineVisualTheme;
};

/**
 * Renders a glass banner when at least one of title or subtitle is set.
 *
 * @param blurTargetRef - Blur sampling target for the glass surface
 * @param title - Primary banner line
 * @param subtitle - Secondary banner line
 * @param sizePx - Indicator size used to place the banner above the badge
 * @param theme - Banner text colors from the visual theme
 * @returns Banner container or null when both lines are absent
 */
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

/**
 * Positions the banner just above the circular badge.
 *
 * @param sizePx - Indicator diameter used for vertical offset
 * @returns Style for the banner's horizontal center and bottom offset
 */
const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx - 6,
  left: "50%",
  width: 200,
  marginLeft: -100,
});
