/**
 * Single timeline row component with left/center/right layout slots.
 * Supports optional per-row minimum height overrides via `row.minHeight`,
 * which takes precedence over the theme's `minSegmentPx` default.
 */

import { type LayoutChangeEvent, View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { TimelineTrack } from "./TimelineTrack";
import type { RequiredTimelineTheme, TimelineRow } from "./TimelineTypes";
import {
  getDurationMinutes,
  getValidatedPercentComplete,
} from "./timelineMath";

export type VerticalTimelineRenderMode = "full" | "background";

export type TimelineRowBounds = {
  y: number;
  height: number;
};

type TimelineRowComponentProps = {
  row: TimelineRow;
  theme: RequiredTimelineTheme;
  rowClassName?: string;
  renderMode: VerticalTimelineRenderMode;
  onRowLayout?: (rowId: string, bounds: TimelineRowBounds) => void;
  isLastRow: boolean;
};

/**
 * Renders a single timeline row with left content, axis, and right content.
 *
 * @param row - Timeline row with content, progress, and optional minHeight override
 * @param theme - Merged theme configuration providing minSegmentPx default
 * @param rowClassName - Optional per-row classes
 * @param renderMode - Full timeline or background-only row rendering
 * @param onRowLayout - Optional callback for row container measurements
 * @param isLastRow - Whether this is the last row in the sequence
 * @returns Timeline row view
 */
export const TimelineRowComponent = ({
  row,
  theme,
  rowClassName,
  renderMode,
  onRowLayout,
  isLastRow,
}: TimelineRowComponentProps) => {
  const durationMinutes = getDurationMinutes(row);
  const percentComplete = getValidatedPercentComplete(row);

  return (
    <View
      className={cn("w-full flex-row items-stretch", rowClassName)}
      style={getVerticalRowStyle(
        durationMinutes,
        theme.minSegmentPx,
        row.minHeight
      )}
      onLayout={getRowLayoutHandler(row.id, onRowLayout)}
    >
      <View className="flex-1 justify-start">{row.leftContent}</View>

      <View
        className="relative self-stretch"
        style={getAxisStyle(theme.centerAxisSizePx)}
      >
        <TimelineTrack
          orientation="vertical"
          percentComplete={percentComplete}
          showTrack={!isLastRow}
          showIndicator={renderMode === "full"}
          theme={theme}
          markerContent={row.markerContent}
          indicatorContent={row.indicatorContent}
        />
      </View>

      <View className="flex-1 justify-start">{row.rightContent}</View>
    </View>
  );
};

/**
 * Builds style for a vertical timeline row segment.
 *
 * The minHeight parameter is an optional per-row override that takes
 * precedence over minSegmentPx. This is useful for exceptional rows
 * that need different minimum heights from the global theme default.
 *
 * @param durationMinutes - Segment flex-grow value derived from row duration
 * @param minSegmentPx - Global theme default for minimum row height in pixels
 * @param minHeight - Optional per-row minimum height override
 * @returns View style for a vertical timeline row
 */
const getVerticalRowStyle = (
  durationMinutes: number,
  minSegmentPx: number,
  minHeight?: number
): ViewStyle => ({
  flexGrow: durationMinutes,
  flexBasis: "auto",
  minHeight: minHeight ?? minSegmentPx,
});

/**
 * Builds style for the center axis container.
 *
 * The axis column provides spacing between left and right content slots
 * and renders the timeline track through its center.
 *
 * @param centerAxisSizePx - Width of the axis column in pixels
 * @returns View style for axis container
 */
const getAxisStyle = (centerAxisSizePx: number): ViewStyle => ({
  width: centerAxisSizePx,
});

/**
 * Builds optional row layout handler for parent measurement.
 *
 * @param rowId - Timeline row identifier
 * @param onRowLayout - Optional row layout callback
 * @returns React Native layout handler or undefined
 */
const getRowLayoutHandler = (
  rowId: string,
  onRowLayout: ((rowId: string, bounds: TimelineRowBounds) => void) | undefined
) =>
  onRowLayout
    ? (event: LayoutChangeEvent) => {
        const { y, height } = event.nativeEvent.layout;
        onRowLayout(rowId, { y, height });
      }
    : undefined;
