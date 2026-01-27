/**
 * TripProgressMarker component for rendering centered circle markers.
 * Used by TripProgressBar to display visual markers at segment endpoints (0% and 100% positions).
 */

import type { ReactNode } from "react";
import { type DimensionValue, View } from "react-native";
import { cn } from "@/lib/utils";
import { CIRCLE_SIZE, shadowStyle } from "./config";

type TripProgressMarkerProps = {
  /**
   * Left position as a percentage string (e.g., "50%") or number.
   */
  left: DimensionValue;
  /**
   * Background color className (e.g., "bg-pink-300" or "bg-white").
   */
  backgroundColor: string;
  /**
   * Border color className (e.g., "border-white/50" or "border-black/25").
   */
  borderColor: string;
  /**
   * Optional z-index for stacking order.
   * On Android, this is also used as the `elevation` to ensure correct stacking.
   */
  zIndex?: number;
  /**
   * Optional size in pixels. Overrides the default CIRCLE_SIZE from config.
   */
  size?: number;
  /**
   * Optional children to render centered inside the circle (e.g., a number string).
   */
  children?: ReactNode;
};

/**
 * Renders a centered circle marker with consistent sizing, positioning, and shadow.
 * The circle is vertically centered and horizontally positioned based on the left prop.
 * Used for visual markers at progress bar segment endpoints.
 *
 * @param left - Left position as percentage string or number
 * @param backgroundColor - Background color className
 * @param borderColor - Border color className
 * @param zIndex - Optional z-index for stacking order
 * @param size - Optional size in pixels to override default CIRCLE_SIZE
 * @param children - Optional children to render centered inside the circle
 * @returns A View component with absolutely positioned circle marker
 */
const TripProgressMarker = ({
  left,
  backgroundColor,
  borderColor,
  zIndex,
  size = CIRCLE_SIZE,
  children,
}: TripProgressMarkerProps) => {
  return (
    <View
      className={cn(
        "absolute rounded-full items-center justify-center",
        backgroundColor,
        borderColor
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
