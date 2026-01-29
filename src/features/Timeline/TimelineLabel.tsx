/**
 * TimelineLabel component for rendering labels between progress bars.
 *
 * The label is rendered inline in the same flex row as the `TimelineBar`s,
 * so its x-coordinate is already aligned with the logical point we care about.
 * We give the wrapper zero width so it does not create a visual gap, and then
 * render the actual label as an absolutely positioned child centered at that
 * x-coordinate.
 */

import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

type TimelineLabelProps = PropsWithChildren<{
  /**
   * Optional className for styling the outer wrapper.
   */
  className?: string;
}>;

/**
 * Renders a label centered beneath the wrapper's x-position.
 *
 * @param children - Label content to display
 * @param className - Optional className for styling the wrapper
 * @returns A View component with an absolutely positioned label
 */
const TimelineLabel = ({ children, className }: TimelineLabelProps) => {
  return (
    <View
      // Zero-width inline wrapper participates in flex layout but creates no gap.
      className={cn("relative", className)}
      style={{
        width: 0,
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 0,
      }}
      pointerEvents="none"
    >
      <View
        // Absolutely positioned relative to this zero-width wrapper.
        className="absolute flex-col items-center justify-start"
        style={{
          left: "50%",
          transform: [{ translateX: "-50%" }],
        }}
      >
        {children}
      </View>
    </View>
  );
};

export default TimelineLabel;
