/**
 * TimelineMarker component for rendering absolutely positioned circle markers.
 * Used by TimelineBar to display visual markers at segment endpoints (0% and 100% positions).
 * The marker is vertically centered on the progress bar and horizontally positioned based on the left prop.
 * Supports custom styling, shadow effects, and optional centered children content.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import { shadowStyle } from "./config";

type TimelineMarkerRenderProp = () => ReactNode;

type TimelineMarkerProps = {
  /**
   * Optional children to render as the label below the marker.
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
};

/**
 * Renders a timeline node consisting of a circle marker and an optional label.
 * The component has zero width to ensure it bookends the TimelineBar without
 * consuming horizontal space in a flex layout. The label is positioned absolutely
 * below the marker.
 *
 * @param children - Optional label content to display below the marker
 * @param className - Optional className for styling the marker circle
 * @param zIndex - Optional z-index for stacking order
 * @param size - Size in pixels for the circle marker (default 20)
 * @returns A View component with a centered circle and absolutely positioned label
 */
const TimelineMarker = ({
  children,
  className,
  zIndex = 10,
  size = 20,
}: TimelineMarkerProps) => {
  const label =
    typeof children === "function"
      ? (children as TimelineMarkerRenderProp)()
      : children;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      className="items-center justify-center"
      style={{
        // The Anchor: Zero width ensures it doesn't shift other flex elements.
        position: "relative",
        width: 0,
        height: 32, // Fixed height to match TimelineBar for consistent alignment
        zIndex,
        elevation: zIndex,
      }}
    >
      {/* The Circle: Automatically centered on the zero-width anchor. */}
      <View
        className={cn(
          "absolute rounded-full items-center justify-center bg-white",
          className
        )}
        style={{
          width: size,
          height: size,
          ...shadowStyle,
          elevation: zIndex ?? shadowStyle.elevation,
          top: (32 - size) / 2, // Center circle within 32px container
        }}
      />

      {/* The Label: Positioned below the marker. */}
      {label && (
        <View
          className="absolute flex-col items-center justify-start mt-3"
          style={{
            top: (32 - size) / 2 + size, // Position below the centered circle
            left: "50%",
            transform: [{ translateX: "-50%" }],
            width: 200, // Provide enough width for label content to center correctly
          }}
        >
          {label}
        </View>
      )}
    </View>
  );
};

export default TimelineMarker;
