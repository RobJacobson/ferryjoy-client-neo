/**
 * TimelineMarker component for rendering absolutely positioned circle markers.
 * Used by TimelineBar to display visual markers at segment endpoints (0% and 100% positions).
 * The marker is vertically centered on the progress bar and horizontally positioned based on the left prop.
 * Supports custom styling, shadow effects, and optional centered children content.
 */

import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import {
  TIMELINE_CIRCLE_SIZE,
  TIMELINE_MARKER_CLASS,
  shadowStyle,
} from "./config";

type TimelineMarkerRenderProp = () => ReactNode;

type TimelineMarkerProps = {
  /**
   * Optional children to render as the label.
   * Can be a node or a function (render-prop).
   */
  children?: ReactNode | TimelineMarkerRenderProp;
  /**
   * Optional className to theme the marker circle (e.g. background/border colors).
   */
  className?: string;
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
   * Position of the label relative to the marker circle.
   * Defaults to "bottom".
   */
  labelPosition?: "bottom" | "left" | "right";
  /**
   * Additional inline styles for the container.
   */
  style?: ViewStyle;
};

/**
 * Renders a timeline node consisting of a circle marker and an optional label.
 * The component has zero width/height (depending on orientation) to ensure it
 * bookends the TimelineBar without consuming space in a flex layout.
 *
 * @param children - Optional label content to display
 * @param className - Optional className for marker circle (defaults to TIMELINE_MARKER_CLASS from config)
 * @param zIndex - Optional z-index for stacking order
 * @param size - Optional size in pixels for the circle (defaults to TIMELINE_CIRCLE_SIZE from config)
 * @param labelPosition - Position of the label relative to the marker
 * @param style - Additional inline styles
 * @returns A View component with a centered circle and positioned label
 */
const TimelineMarker = ({
  children,
  className = TIMELINE_MARKER_CLASS,
  zIndex = 10,
  size = TIMELINE_CIRCLE_SIZE,
  labelPosition = "bottom",
  style,
}: TimelineMarkerProps) => {
  const label =
    typeof children === "function"
      ? (children as TimelineMarkerRenderProp)()
      : children;

  const isVertical = labelPosition === "left" || labelPosition === "right";

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      className="items-center justify-center"
      style={{
        // The Anchor: Zero width/height ensures it doesn't shift other flex elements.
        position: isVertical ? "absolute" : "relative",
        width: isVertical ? "100%" : 0,
        height: 32, // Fixed height to match TimelineBar for consistent alignment
        zIndex,
        elevation: zIndex,
        ...style,
      }}
    >
      {/* The Circle: Automatically centered on the anchor. */}
      <View
        className={cn(
          "absolute rounded-full items-center justify-center",
          className
        )}
        style={{
          width: size,
          height: size,
          ...shadowStyle,
          elevation: zIndex ?? shadowStyle.elevation,
          top: (32 - size) / 2, // Center circle within 32px container
          left: isVertical ? "50%" : undefined,
          marginLeft: isVertical ? -size / 2 : undefined,
        }}
      />

      {/* The Label: Positioned relative to the marker. */}
      {label && (
        <View
          className={cn(
            "absolute flex-col",
            labelPosition === "bottom"
              ? "items-center justify-start mt-3"
              : labelPosition === "left"
                ? "items-end justify-center pr-4"
                : "items-start justify-center pl-4"
          )}
          style={{
            top: labelPosition === "bottom" ? (32 - size) / 2 + size : 0,
            bottom: isVertical ? 0 : undefined,
            left: labelPosition === "bottom" ? "50%" : undefined,
            right: labelPosition === "left" ? "50%" : undefined,
            marginLeft: labelPosition === "right" ? size / 2 : undefined,
            marginRight: labelPosition === "left" ? size / 2 : undefined,
            transform:
              labelPosition === "bottom" ? [{ translateX: "-50%" }] : undefined,
            width: 200, // Provide enough width for label content
          }}
        >
          {label}
        </View>
      )}
    </View>
  );
};

export default TimelineMarker;
