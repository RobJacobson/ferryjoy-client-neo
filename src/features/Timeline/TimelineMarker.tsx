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

type TimelineMarkerProps = {
  /**
   * Optional children to render as the label below the marker.
   */
  children?: ReactNode;
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
  return (
    <View
      pointerEvents="none"
      className="items-center justify-center"
      style={{
        // The Anchor: Zero width ensures it doesn't shift other flex elements.
        position: "relative",
        width: 0,
        height: size, // Match circle size instead of 100%
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
          top: 0, // Position at top 0 of the size-constrained container
        }}
      />

      {/* The Label: Positioned below the marker. */}
      {children && (
        <View
          className="absolute flex-col items-center justify-start mt-3"
          style={{
            top: size, // Position below the circle
            left: "50%",
            transform: [{ translateX: "-50%" }],
            width: 200, // Provide enough width for label content to center correctly
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
};

export default TimelineMarker;
