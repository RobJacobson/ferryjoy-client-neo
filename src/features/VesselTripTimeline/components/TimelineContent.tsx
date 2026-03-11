/**
 * Timeline content area: base track plus rows plus a single absolute overlay.
 * This feature intentionally renders TimelineRowComponent directly instead of
 * the higher-level VerticalTimeline because the full-surface blur overlay
 * needs feature-local measurement and overlay control.
 */

import { BlurTargetView } from "expo-blur";
import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent, View as RNView } from "react-native";
import { TimelineRowComponent } from "@/components/Timeline";
import type { RequiredTimelineTheme } from "@/components/Timeline/TimelineTypes";
import { View } from "@/components/ui";
import { clamp } from "@/shared/utils";
import type {
  RowLayoutBounds,
  TimelineActiveIndicator,
  TimelineRenderState,
} from "../types";
import { FullTimelineTrack } from "./FullTimelineTrack";
import { RowContentLabel } from "./RowContentLabel";
import { RowContentTimes } from "./RowContentTimes";
import { TimelineIndicatorOverlay } from "./TimelineIndicatorOverlay";

const TIMELINE_THEME: RequiredTimelineTheme = {
  minSegmentPx: 32,
  centerAxisSizePx: 42,
  trackThicknessPx: 8,
  markerSizePx: 24,
  indicatorSizePx: 36,
  completeTrackClassName: "bg-green-400",
  upcomingTrackClassName: "bg-green-100",
  markerClassName: "border border-green-500 bg-white",
  indicatorClassName: "border border-green-500 bg-green-100",
};

const getBoundaryTopPx = (
  activeIndicator: TimelineActiveIndicator | null,
  rowLayouts: Record<string, RowLayoutBounds>
): number => {
  if (!activeIndicator) {
    return 0;
  }
  const layout = rowLayouts[activeIndicator.rowId];
  if (!layout) {
    return 0;
  }
  return (
    layout.y + layout.height * clamp(activeIndicator.positionPercent, 0, 1)
  );
};

/**
 * Renders vessel timeline: full-height track, rows, and indicator overlay.
 *
 * @param props - Render-ready rows and active indicator
 * @returns Timeline with measured-layout BlurView indicator
 */
export const TimelineContent = ({
  rows: renderRows,
  activeIndicator,
}: TimelineRenderState) => {
  const blurTargetRef = useRef<RNView | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [rowLayouts, setRowLayouts] = useState<Record<string, RowLayoutBounds>>(
    {}
  );

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    setContainerHeight(height);
  }, []);

  const onRowLayout = useCallback((rowId: string, bounds: RowLayoutBounds) => {
    setRowLayouts((prev) =>
      prev[rowId]?.y === bounds.y && prev[rowId]?.height === bounds.height
        ? prev
        : { ...prev, [rowId]: bounds }
    );
  }, []);

  const boundaryTopPx = getBoundaryTopPx(activeIndicator, rowLayouts);

  return (
    <View className="relative h-[350px]">
      <BlurTargetView
        ref={blurTargetRef}
        className="relative flex-1 flex-col"
        collapsable={false}
        onLayout={onContainerLayout}
      >
        <FullTimelineTrack
          containerHeightPx={containerHeight}
          boundaryTopPx={boundaryTopPx}
          theme={TIMELINE_THEME}
        />
        {renderRows.map((row, index) => (
          <TimelineRowComponent
            key={row.id}
            id={row.id}
            durationMinutes={row.geometryMinutes}
            minHeight={row.layoutMode === "content" ? 0 : undefined}
            leftContent={
              <RowContentLabel
                startLabel={row.startBoundary}
                endLabel={row.endBoundary}
              />
            }
            rightContent={
              <RowContentTimes
                startPoint={row.startBoundary.timePoint}
                endPoint={row.endBoundary?.timePoint}
              />
            }
            theme={TIMELINE_THEME}
            isLastRow={index === renderRows.length - 1}
            onRowLayout={onRowLayout}
          />
        ))}
        <TimelineIndicatorOverlay
          overlayIndicator={activeIndicator}
          blurTargetRef={blurTargetRef}
          rowLayouts={rowLayouts}
        />
      </BlurTargetView>
    </View>
  );
};
