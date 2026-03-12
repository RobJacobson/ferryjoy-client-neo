/**
 * Circular dot for static timeline segment markers in the row center slot.
 * Wraps the axis column (relative, self-stretch) with the dot absolutely
 * positioned at top-center. Provides a centered container with optional
 * inner content and configurable sizing.
 */

import type { PropsWithChildren } from "react";
import { View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";

type TimelineIndicatorProps = PropsWithChildren<{
  centerAxisSizePx: number;
  sizePx: number;
  className?: string;
}>;

/**
 * Renders a circular timeline dot at the row center axis.
 *
 * @param centerAxisSizePx - Width of the axis column in pixels
 * @param sizePx - Dot size in pixels
 * @param className - Optional NativeWind classes
 * @param children - Optional inner content
 * @returns Dot view
 */
export const TimelineMarker = ({
  centerAxisSizePx,
  sizePx,
  className,
  children,
}: TimelineIndicatorProps) => (
  <View className={`relative self-stretch w-[${centerAxisSizePx}px] mx-4`}>
    <View className="absolute" style={getMarkerStyle(sizePx)}>
      <View
        className={cn(
          `items-center justify-center rounded-full w-[${sizePx}px] h-[${sizePx}px]`,
          className
        )}
      >
        {children}
      </View>
    </View>
  </View>
);

/**
 * Builds style for the segment-start marker at top center of the axis.
 *
 * @param markerSizePx - Marker diameter in pixels for centering
 * @returns View style for marker dot container
 */
const getMarkerStyle = (markerSizePx: number): ViewStyle => ({
  zIndex: 1,
  ...getAbsoluteCenteredBoxStyle({
    width: markerSizePx,
    height: markerSizePx,
    isVertical: true,
  }),
});
