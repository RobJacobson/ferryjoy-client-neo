/**
 * TimelineMarker provides the anchor and circle. Use TimelineMarkerContent as child for the content slot (centered by default; use its className to position).
 */

import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { shadowStyle, timelineMarkerConfig } from "./config";

type TimelineMarkerProps = {
  /**
   * Optional children (e.g. TimelineMarkerContent wrapping label + times).
   */
  children?: ReactNode;
  /**
   * Optional className for the outer container (flex anchor).
   */
  className?: string;
  /**
   * Optional className for the circle (defaults to timelineMarkerConfig.markerClass).
   */
  circleClassName?: string;
  /**
   * Optional z-index for stacking order.
   * On Android, this is also used as the `elevation` to ensure correct stacking.
   */
  zIndex?: number;
  /**
   * Size in pixels for the circle marker.
   */
  size?: number;
  /**
   * Outer slot only: horizontal = zero-width anchor; vertical = full-width row.
   * Content slot is always the same; use TimelineMarkerContent className (e.g. mt-4, ml-8, mr-8) to position.
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Additional inline styles for the container.
   */
  style?: ViewStyle;
};

/**
 * Renders a timeline node: anchor container and circle. Children (e.g. TimelineMarkerContent) provide the content slot.
 */
const TimelineMarker = ({
  children,
  className,
  circleClassName = timelineMarkerConfig.markerClass,
  zIndex = 10,
  size = timelineMarkerConfig.circleSize,
  orientation = "horizontal",
  style,
}: TimelineMarkerProps) => {
  const isVertical = orientation === "vertical";
  const slotHeight = timelineMarkerConfig.containerHeight;
  const circleTop = (slotHeight - size) / 2;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      className={cn("items-center justify-center", className)}
      style={{
        position: "relative",
        width: isVertical ? "100%" : 0,
        height: isVertical ? 0 : slotHeight,
        zIndex,
        elevation: zIndex,
        ...style,
      }}
    >
      <View
        className={cn(
          "absolute rounded-full items-center justify-center",
          circleClassName
        )}
        style={{
          width: size,
          height: size,
          ...shadowStyle,
          elevation: zIndex ?? shadowStyle.elevation,
          top: isVertical ? -size / 2 : circleTop,
          left: isVertical ? "50%" : 0,
          marginLeft: -size / 2,
        }}
      />
      {children}
    </View>
  );
};

export default TimelineMarker;
