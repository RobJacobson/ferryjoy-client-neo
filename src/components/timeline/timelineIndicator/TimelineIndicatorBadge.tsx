/**
 * Circular badge label centered on the active timeline indicator.
 */

import type { ComponentRef, RefObject } from "react";
import type { ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import { TimelineIndicatorGlass } from "./TimelineIndicatorGlass";

type TimelineIndicatorBadgeProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  label: string;
  sizePx: number;
  theme: TimelineVisualTheme;
};

/**
 * Glass-backed single-line label at the track column center.
 *
 * @param blurTargetRef - Blur sampling target for the glass surface
 * @param label - Badge text content
 * @param sizePx - Diameter used for horizontal centering on the track
 * @param theme - Badge text color from the visual theme
 * @returns Positioned badge view
 */
export const TimelineIndicatorBadge = ({
  blurTargetRef,
  label,
  sizePx,
  theme,
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
      style={{ color: theme.indicator.badgeLabelColor }}
    >
      {label}
    </Text>
  </TimelineIndicatorGlass>
);

/**
 * Centers the badge horizontally on the vertical track column.
 *
 * @param sizePx - Badge width and height in pixels
 * @returns Absolute positioning style for the badge
 */
const getBadgeStyle = (sizePx: number): ViewStyle => ({
  left: "50%",
  width: sizePx,
  height: sizePx,
  marginLeft: -sizePx / 2,
});
