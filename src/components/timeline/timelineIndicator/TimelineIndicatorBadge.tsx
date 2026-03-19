import type { ComponentRef, RefObject } from "react";
import type { ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";
import {
  DEFAULT_TIMELINE_VISUAL_THEME,
  type TimelineVisualTheme,
} from "../theme";
import { TimelineIndicatorGlass } from "./TimelineIndicatorGlass";

type TimelineIndicatorBadgeProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  label: string;
  sizePx: number;
  theme?: TimelineVisualTheme;
};

export const TimelineIndicatorBadge = ({
  blurTargetRef,
  label,
  sizePx,
  theme = DEFAULT_TIMELINE_VISUAL_THEME,
}: TimelineIndicatorBadgeProps) => (
  <TimelineIndicatorGlass
    blurTargetRef={blurTargetRef}
    theme={theme}
    className="absolute"
    style={getBadgeStyle(sizePx)}
    contentClassName="h-full w-full items-center justify-center"
  >
    <Text
      className="font-playpen-600"
      style={[
        { color: theme.indicator.badgeTextColor },
        theme.indicator.badgeTextStyle,
      ]}
    >
      {label}
    </Text>
  </TimelineIndicatorGlass>
);

const getBadgeStyle = (sizePx: number): ViewStyle => ({
  left: "50%",
  width: sizePx,
  height: sizePx,
  marginLeft: -sizePx / 2,
});
