/**
 * TimelineMarker component for rendering absolutely positioned circle markers.
 * Used by TimelineBar to display visual markers at segment endpoints (0% and 100% positions).
 * The marker is vertically centered on the progress bar and horizontally positioned based on the left prop.
 * Supports custom styling, shadow effects, and optional centered children content.
 */

import type { ReactNode } from "react";
import { type DimensionValue, View } from "react-native";
import { cn } from "@/lib/utils";
import { shadowStyle } from "./config";

type TimelineMarkerProps = {
  /**
   * Left position as a percentage string (e.g., "50%") or number.
   * If omitted, the marker is positioned according to Flexbox layout.
   */
  left?: DimensionValue;
  /**
   * Optional className to theme the marker (e.g. background/border colors).
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
   * Optional children to render centered inside the circle (e.g., a number string).
   */
  children?: ReactNode;
};

/**
 * Renders an absolutely positioned circle marker with consistent sizing, positioning, and shadow.
 * The circle is vertically centered on the progress bar using top: "50%" and transform translateY,
 * and horizontally positioned based on the left prop with transform translateX to center the circle
 * on its position point. Used for visual markers at progress bar segment endpoints (0% and 100%).
 *
 * @param left - Left position as percentage string (e.g., "0%", "100%") or number for horizontal placement
 * @param backgroundColor - Background color className (e.g., "bg-white", "bg-pink-300")
 * @param borderColor - Border color className (e.g., "border border-pink-500", "border-white/50")
 * @param zIndex - Optional z-index for stacking order; on Android also used as elevation
 * @param size - Size in pixels for the circle marker (default 20)
 * @param children - Optional children to render centered inside the circle
 * @returns A View component with absolutely positioned, vertically and horizontally centered circle marker
 */
const TimelineMarker = ({
  left,
  className,
  zIndex,
  size = 20,
  children,
}: TimelineMarkerProps) => {
  return (
    <View
      pointerEvents="none"
      className="items-center justify-center"
      style={{
        // The Anchor: Zero width ensures it doesn't shift other flex elements.
        // If 'left' is provided, it's absolute; otherwise, it's a flex participant.
        position: left !== undefined ? "absolute" : "relative",
        left,
        width: 0,
        height: "100%",
        zIndex,
      }}
    >
      <View
        className={cn(
          "absolute rounded-full items-center justify-center bg-white",
          className
        )}
        style={{
          // The Circle: Automatically centered on the zero-width anchor.
          width: size,
          height: size,
          ...shadowStyle,
          elevation: zIndex ?? shadowStyle.elevation,
        }}
      >
        {children}
      </View>
    </View>
  );
};

export default TimelineMarker;
