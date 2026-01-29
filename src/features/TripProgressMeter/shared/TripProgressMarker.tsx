/**
 * TripProgressMarker component for rendering absolutely positioned circle markers.
 * Used by TripProgressBar to display visual markers at segment endpoints (0% and 100% positions).
 * The marker is vertically centered on the progress bar and horizontally positioned based on the left prop.
 * Supports custom styling, shadow effects, and optional centered children content.
 */

import type { ReactNode } from "react";
import { type DimensionValue, View } from "react-native";
import { cn } from "@/lib/utils";
import { shadowStyle } from "./config";

type TripProgressMarkerProps = {
  /**
   * Left position as a percentage string (e.g., "50%") or number.
   */
  left: DimensionValue;
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
const TripProgressMarker = ({
  left,
  className,
  zIndex,
  size = 20,
  children,
}: TripProgressMarkerProps) => {
  return (
    <View
      className={cn(
        "absolute rounded-full items-center justify-center",
        className
      )}
      pointerEvents="none"
      style={{
        top: "50%",
        left,
        transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
        width: size,
        height: size,
        zIndex,
        ...shadowStyle,
        elevation: zIndex ?? shadowStyle.elevation,
      }}
    >
      {children}
    </View>
  );
};

export default TripProgressMarker;
