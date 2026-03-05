/**
 * Domain-agnostic vertical timeline primitive with flexible row composition.
 *
 * Render modes:
 * - "full": renders track + marker + per-row moving indicator (default)
 * - "background": renders track + marker only, for use with external overlay
 *
 * External overlays (e.g., VerticalTimelineIndicatorOverlay) can use
 * onRowLayout to measure rows and position absolute indicators above
 * the timeline surface.
 */

import { View } from "react-native";
import { cn } from "@/lib/utils";
import { TimelineRowComponent } from "./TimelineRow";
import {
  DEFAULT_TIMELINE_THEME,
  type RequiredTimelineTheme,
  type TimelineRow,
  type TimelineTheme,
} from "./TimelineTypes";

type VerticalTimelineProps = {
  rows: TimelineRow[];
  theme?: TimelineTheme;
  className?: string;
  rowClassName?: string;
  // Controls whether per-row moving indicators are rendered.
  renderMode?: "full" | "background";
  // Parent receives absolute row bounds to position external overlays.
  onRowLayout?: (
    rowId: string,
    { y, height }: { y: number; height: number }
  ) => void;
};

/**
 * Renders a vertical timeline with left/center/right row slots.
 *
 * @param rows - Timeline rows with Date range and completion
 * @param theme - Optional theme configuration with defaults applied
 * @param className - Optional container classes
 * @param rowClassName - Optional per-row classes
 * @param renderMode - Full timeline or background-only row rendering
 * @param onRowLayout - Optional callback for row container measurements
 * @returns Vertical timeline view
 */
export const VerticalTimeline = ({
  rows,
  theme = {},
  className,
  rowClassName,
  renderMode = "full",
  onRowLayout,
}: VerticalTimelineProps) => {
  const mergedTheme: RequiredTimelineTheme = {
    ...DEFAULT_TIMELINE_THEME,
    ...theme,
  };

  return (
    <View className={cn("w-full flex-col", className)}>
      {rows.map((row) => (
        <TimelineRowComponent
          key={row.id}
          row={row}
          theme={mergedTheme}
          rowClassName={rowClassName}
          renderMode={renderMode}
          onRowLayout={onRowLayout}
          isLastRow={rows[rows.length - 1]?.id === row.id}
        />
      ))}
    </View>
  );
};
