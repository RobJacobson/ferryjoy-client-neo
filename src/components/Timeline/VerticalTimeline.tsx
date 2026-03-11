/**
 * Domain-agnostic vertical timeline primitive with flexible row composition.
 *
 * Renders rows with left/center/right slots (content + segment-start marker).
 * Track bars and moving indicators are rendered by feature-level overlays
 * (e.g. FullTimelineTrack + TimelineIndicatorOverlay in VesselTripTimeline).
 */

import { View } from "react-native";
import { cn } from "@/lib/utils";
import { TimelineRow } from "./TimelineRow";
import {
  DEFAULT_TIMELINE_THEME,
  type RequiredTimelineTheme,
  type TimelineRow as TimelineRowModel,
  type TimelineTheme,
} from "./TimelineTypes";

type VerticalTimelineProps = {
  rows: TimelineRowModel[];
  theme?: TimelineTheme;
  className?: string;
  rowClassName?: string;
  onRowLayout?: (
    rowId: string,
    { y, height }: { y: number; height: number }
  ) => void;
};

/**
 * Renders a vertical timeline with left/center/right row slots.
 *
 * @param rows - Timeline rows with duration-based sizing
 * @param theme - Optional theme configuration with defaults applied
 * @param className - Optional container classes
 * @param rowClassName - Optional per-row classes
 * @param onRowLayout - Optional callback for row container measurements
 * @returns Vertical timeline view
 */
export const VerticalTimeline = ({
  rows,
  theme = {},
  className,
  rowClassName,
  onRowLayout,
}: VerticalTimelineProps) => {
  const mergedTheme: RequiredTimelineTheme = {
    ...DEFAULT_TIMELINE_THEME,
    ...theme,
  };

  return (
    <View className={cn("w-full flex-col", className)}>
      {rows.map((row) => (
        <TimelineRow
          key={row.id}
          id={row.id}
          durationMinutes={row.durationMinutes}
          leftContent={row.leftContent}
          rightContent={row.rightContent}
          markerContent={row.markerContent}
          minHeight={row.minHeight}
          theme={mergedTheme}
          rowClassName={rowClassName}
          onRowLayout={onRowLayout}
          isLastRow={rows[rows.length - 1]?.id === row.id}
        />
      ))}
    </View>
  );
};
