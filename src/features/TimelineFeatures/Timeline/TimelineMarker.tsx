/**
 * TimelineMarker provides the anchor, circle, and flex container for marker content.
 * Used by TimelineBar and vertical timelines. Content positioning is handled by TimelineMarkerContent.
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
   * Layout: horizontal (zero-width anchor, circle absolute) or vertical (full-width, circle in flow).
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Additional inline styles for the container.
   */
  style?: ViewStyle;
};

/**
 * Renders a timeline node: anchor container, circle, and children (e.g. TimelineMarkerContent).
 *
 * @param children - Optional content (typically TimelineMarkerContent)
 * @param className - Optional className for the container
 * @param circleClassName - Optional className for the circle (defaults to timelineMarkerConfig.markerClass)
 * @param zIndex - Optional z-index for stacking order
 * @param size - Optional size in pixels for the circle
 * @param orientation - horizontal (default) or vertical
 * @param style - Additional inline styles for the container
 * @returns A View with circle and flex container for children
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

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      className={cn("items-center justify-center", className)}
      style={{
        position: isVertical ? "absolute" : "relative",
        width: isVertical ? "100%" : 0,
        height: timelineMarkerConfig.containerHeight,
        flexDirection: isVertical ? "row" : "column",
        zIndex,
        elevation: zIndex,
        ...style,
      }}
    >
      {/* Circle: absolute and centered so it sits on the track in both orientations */}
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
          top: (timelineMarkerConfig.containerHeight - size) / 2,
          left: 0,
          marginLeft: -size / 2,
        }}
      />
      {children}
    </View>
  );
};

export default TimelineMarker;
