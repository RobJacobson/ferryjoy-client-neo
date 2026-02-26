/**
 * Layout wrapper for timeline blocks (dock, sea).
 * Ensures consistent schematic layout (flex-grow + min-width) across block types.
 */

import type { ReactNode } from "react";
import type { DimensionValue, ViewStyle } from "react-native";
import { View } from "react-native";
import { timelineIndicatorConfig, timelineSegmentConfig } from "./config";

type TimelineBlockProps = {
  /**
   * Proportional width allocation based on duration.
   * Ignored when equalWidth is true.
   */
  duration: number;
  /**
   * Block content (TimelineBar, TimelineIndicator, etc).
   */
  children: ReactNode;
  /**
   * When true, use equal flexGrow (1) so each block gets the same width (e.g. 25% for 4 blocks).
   * Use when total block count is 4 to avoid expansion beyond 100%.
   */
  equalWidth?: boolean;
  /**
   * Total number of blocks in the row. Only used when equalWidth is true, to set minWidth to 100/segmentCount%
   * so each block gets exactly equal width (e.g. 25% for 4 blocks). When equalWidth is false, config minWidth is used.
   */
  segmentCount?: number;
  /**
   * Orientation of the timeline.
   * Defaults to "horizontal".
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Optional additional styles.
   */
  style?: ViewStyle;
};

/**
 * A layout wrapper that enforces the "schematic" timeline design.
 * Uses flex-grow for proportional width while maintaining a minimum width
 * to prevent label overlap and ensure legibility. Uses flexBasis: 0 so width
 * is determined only by flex distribution (not content), keeping the row within 100%.
 *
 * @param duration - FlexGrow value (minutes); ignored when equalWidth is true
 * @param children - Block content
 * @param equalWidth - When true, use flexGrow 1 for equal-width blocks (e.g. 25% each for 4)
 * @param segmentCount - Total blocks in row; minWidth set to 100/segmentCount% to avoid overflow
 * @param orientation - Orientation of the timeline
 * @param style - Optional inline styles
 */
export const TimelineBlock = ({
  duration,
  children,
  equalWidth = false,
  segmentCount,
  orientation = "horizontal",
  style,
}: TimelineBlockProps) => {
  const isVertical = orientation === "vertical";

  // Only use segmentCount-based minWidth when equalWidth; otherwise use config so duration-based flexGrow can distribute space
  const minDimension: DimensionValue =
    equalWidth && segmentCount
      ? `${100 / segmentCount}%`
      : isVertical
        ? "10%" // Minimum height for vertical blocks
        : timelineSegmentConfig.minWidth;

  return (
    <View
      style={[
        {
          flexBasis: 0,
          flexGrow: equalWidth ? 1 : Math.max(1, duration),
          flexShrink: 1,
          [isVertical ? "minHeight" : "minWidth"]: minDimension,
          [isVertical ? "width" : "height"]: timelineIndicatorConfig.size,
          flexDirection: isVertical ? "column" : "row",
          alignItems: "center",
        },
        style,
      ]}
      className="relative"
    >
      {children}
    </View>
  );
};
