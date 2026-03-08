/**
 * Single timeline row component with left/center/right layout slots.
 * Supports optional per-row minimum height overrides via `row.minHeight`,
 * which takes precedence over the theme's `minSegmentPx` default.
 */

import type { ReactNode } from "react";
import {
  type LayoutChangeEvent,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { cn } from "@/lib/utils";
import { TimelineTrack } from "./TimelineTrack";
import type { RequiredTimelineTheme, TimelineRow } from "./TimelineTypes";

export type VerticalTimelineRenderMode = "full" | "background";

export type TimelineRowBounds = {
  y: number;
  height: number;
};

const ACTIVE_OVERLAY_Z_INDEX = 10;

type TimelineRowComponentProps = {
  row: TimelineRow;
  theme: RequiredTimelineTheme;
  rowClassName?: string;
  renderMode: VerticalTimelineRenderMode;
  onRowLayout?: (rowId: string, bounds: TimelineRowBounds) => void;
  isLastRow: boolean;
  /** Optional overlay (e.g., BlurView indicator) positioned absoluteFill; row adds position: relative when provided. */
  overlay?: ReactNode;
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
  overlay,
}: TimelineRowComponentProps) => {
  const rowStyle = getVerticalRowStyle(
    row.durationMinutes,
    theme.minSegmentPx,
    row.minHeight
  );
  const containerStyle = getContainerStyle(rowStyle, overlay);

  return (
    <View
      className={cn("w-full flex-row items-stretch", rowClassName)}
      style={containerStyle}
      onLayout={getRowLayoutHandler(row.id, onRowLayout)}
    >
      <View className="flex-1 justify-start">{row.leftContent}</View>

      <View
        className="relative self-stretch"
        style={getAxisStyle(theme.centerAxisSizePx)}
      >
        <TimelineTrack
          orientation="vertical"
          percentComplete={row.percentComplete}
          showTrack={!isLastRow}
          showIndicator={renderMode === "full"}
          theme={theme}
          markerContent={row.markerContent}
          indicatorContent={row.indicatorContent}
        />
      </View>

      <View className="flex-1 justify-start">{row.rightContent}</View>

      {overlay && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {overlay}
        </View>
      )}
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
 * When minHeight is 0, the row should not expand beyond its content,
 * so flexGrow is set to 0.
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
  flexGrow: minHeight === 0 ? 0 : durationMinutes,
  flexBasis: "auto",
  minHeight: minHeight ?? minSegmentPx,
});

/**
 * Builds the outer row container style, including overlay stacking behavior.
 *
 * When an overlay is present, the row itself must be promoted above sibling
 * rows so the overlay can paint across row boundaries. Raising only the
 * overlay child would still leave it trapped inside the row's stacking order.
 *
 * @param rowStyle - Base vertical row sizing style
 * @param overlay - Optional row-local overlay content
 * @returns View style for the outer row container
 */
const getContainerStyle = (
  rowStyle: ViewStyle,
  overlay?: ReactNode
): ViewStyle =>
  overlay
    ? {
        ...rowStyle,
        position: "relative",
        overflow: "visible",
        zIndex: ACTIVE_OVERLAY_Z_INDEX,
        elevation: ACTIVE_OVERLAY_Z_INDEX,
      }
    : rowStyle;

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
