/**
 * Single timeline row component with left/center/right layout slots.
 * Supports optional per-row minimum height overrides via `row.minHeight`,
 * which takes precedence over the theme's `minSegmentPx` default.
 *
 * Center slot renders only the segment-start marker; track bars are drawn
 * by a separate base-layer component (e.g. FullTimelineTrack in features).
 */

import type { ReactNode } from "react";
import { type LayoutChangeEvent, View, type ViewStyle } from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TimelineMarker } from "./TimelineMarker";
import type { RequiredTimelineTheme } from "./TimelineTypes";

export type TimelineRowBounds = {
  y: number;
  height: number;
};

const ROW_LAYOUT_TRANSITION_DURATION_MS = 2000;

export type TimelineRowComponentProps = {
  id: string;
  durationMinutes: number;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  markerContent?: ReactNode;
  minHeight?: number;
  theme: RequiredTimelineTheme;
  rowClassName?: string;
  onRowLayout?: (rowId: string, bounds: TimelineRowBounds) => void;
  isLastRow?: boolean;
};

/**
 * Renders a single timeline row with left content, center marker, and right content.
 *
 * @param props - Flattened row layout and content props
 * @returns Timeline row view
 */
export const TimelineRow = ({
  id,
  durationMinutes,
  leftContent,
  rightContent,
  markerContent,
  minHeight,
  theme,
  rowClassName,
  onRowLayout,
  isLastRow,
}: TimelineRowComponentProps) => {
  const rowStyle = getVerticalRowStyle(
    durationMinutes,
    theme.minSegmentPx,
    minHeight
  );

  return (
    <Animated.View
      className={cn("w-full flex-row items-stretch", rowClassName)}
      style={rowStyle}
      layout={LinearTransition.duration(
        ROW_LAYOUT_TRANSITION_DURATION_MS
      ).easing(Easing.inOut(Easing.quad))}
      onLayout={getRowLayoutHandler(id, onRowLayout)}
    >
      <View className="flex-1 justify-start">{leftContent}</View>

      <View
        className="relative self-stretch"
        style={getAxisStyle(theme.centerAxisSizePx)}
      >
        <View className="absolute" style={getMarkerStyle(theme.markerSizePx)}>
          <TimelineMarker
            sizePx={theme.markerSizePx}
            className={theme.markerClassName}
          >
            {markerContent}
          </TimelineMarker>
        </View>
      </View>

      <View className="flex-1 justify-start">{rightContent}</View>
    </Animated.View>
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
 * Builds style for the center axis container.
 *
 * The axis column provides spacing between left and right content slots
 * and renders the segment-start marker through its center.
 *
 * @param centerAxisSizePx - Width of the axis column in pixels
 * @returns View style for axis container
 */
const getAxisStyle = (centerAxisSizePx: number): ViewStyle => ({
  width: centerAxisSizePx,
});

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
