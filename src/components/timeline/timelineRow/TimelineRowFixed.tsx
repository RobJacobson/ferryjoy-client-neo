/**
 * Timeline row shell with a fixed pixel height (precomputed layout).
 */

import type { ReactNode } from "react";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";

type TimelineRowFixedProps = {
  heightPx: number;
  rowClassName?: string;
  children: ReactNode;
};

/**
 * Renders a timeline segment container with explicit height from upstream geometry.
 *
 * @param heightPx - Row height in pixels
 * @param rowClassName - Optional width/layout classes for the row container
 * @param children - Row contents (typically `TimelineRowContent`)
 * @returns Row container with fixed vertical size
 */
const TimelineRowFixed = ({
  heightPx,
  rowClassName,
  children,
}: TimelineRowFixedProps) => (
  <View className={cn("w-full", rowClassName)} style={{ height: heightPx }}>
    {children}
  </View>
);

export type { TimelineRowFixedProps };
export { TimelineRowFixed };
