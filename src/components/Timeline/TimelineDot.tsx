/**
 * Generic dot for timeline marker and moving indicator.
 */

import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

type TimelineDotProps = PropsWithChildren<{
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
export const TimelineDot = ({
  sizePx,
  className,
  children,
}: TimelineDotProps) => (
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
