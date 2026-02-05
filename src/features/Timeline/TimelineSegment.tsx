/**
 * Internal layout helper for Timeline segments.
 * Ensures consistent schematic layout (flex-grow + min-width) across different segment types.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";

type TimelineSegmentProps = {
  /**
   * Proportional width allocation based on duration.
   */
  duration: number;
  /**
   * Segment content (TimelineBar, TimelineIndicator, etc).
   */
  children: ReactNode;
  /**
   * Optional additional styles.
   */
  style?: ViewStyle;
};

/**
 * A layout wrapper that enforces the "schematic" timeline design.
 * Uses flex-grow for proportional width while maintaining a minimum width
 * to prevent label overlap and ensure legibility.
 *
 * @param duration - FlexGrow value (minutes)
 * @param children - Segment content
 * @param style - Optional inline styles
 */
export const TimelineSegment = ({
  duration,
  children,
  style,
}: TimelineSegmentProps) => (
  <View
    style={[
      {
        flexGrow: Math.max(1, duration),
        minWidth: "22%",
        height: 32,
      },
      style,
    ]}
    className="relative"
  >
    {children}
  </View>
);
