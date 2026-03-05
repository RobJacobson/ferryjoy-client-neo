/**
 * Reusable circular dot component for timeline markers and moving indicators.
 * Provides a centered container with optional inner content and configurable
 * sizing via NativeWind classes or inline styles.
 */

import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

type TimelineIndicatorProps = PropsWithChildren<{
  sizePx: number;
  className?: string;
}>;

/**
 * Renders a circular timeline dot.
 *
 * @param sizePx - Dot size in pixels
 * @param className - Optional NativeWind classes
 * @param children - Optional inner content
 * @returns Dot view
 */
export const TimelineMarker = ({
  sizePx,
  className,
  children,
}: TimelineIndicatorProps) => (
  <View
    className={cn("size-2 items-center justify-center rounded-full", className)}
    style={{
      width: sizePx,
      height: sizePx,
    }}
  >
    {children}
  </View>
);
