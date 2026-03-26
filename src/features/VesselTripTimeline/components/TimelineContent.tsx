/**
 * Timeline content area: base track plus rows plus a single absolute overlay.
 * This feature intentionally renders the shared TimelineRowComponent directly
 * instead of the higher-level VerticalTimeline because the full-surface blur
 * overlay needs feature-local measurement and overlay control.
 */

import { BlurTargetView } from "expo-blur";
import { type ComponentRef, useCallback, useRef, useState } from "react";
import {
  BASE_TIMELINE_VISUAL_THEME,
  TimelineIndicatorOverlay,
  TimelineRow,
  TimelineRowContent,
  TimelineTrack,
  useAnimatedProgress,
} from "@/components/timeline";
import { getBoundaryTopPx } from "@/components/timeline/viewState";
import { View } from "@/components/ui";
import type {
  RowLayoutBounds,
  TimelineRenderRow,
  TimelineRenderState,
} from "../types";

const CONTAINER_HEIGHT_PX = 350;

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
  const theme = BASE_TIMELINE_VISUAL_THEME;
  const blurTargetRef = useRef<ComponentRef<typeof View> | null>(null);
  const [rowLayouts, setRowLayouts] = useState<Record<string, RowLayoutBounds>>(
    {}
  );

  const onRowLayout = useCallback((rowId: string, bounds: RowLayoutBounds) => {
    setRowLayouts((prev) =>
      prev[rowId]?.y === bounds.y && prev[rowId]?.height === bounds.height
        ? prev
        : { ...prev, [rowId]: bounds }
    );
  }, []);

  const boundaryTopPx = getBoundaryTopPx(activeIndicator, rowLayouts);
  const animatedBoundaryTopPx = useAnimatedProgress(boundaryTopPx ?? 0);

  return (
    <View className="relative h-[350px]">
      <BlurTargetView
        ref={blurTargetRef}
        className="relative flex-1 flex-col"
        collapsable={false}
      >
        <TimelineTrack
          containerHeightPx={CONTAINER_HEIGHT_PX}
          completedBoundaryTopPx={
            activeIndicator && boundaryTopPx !== null ? animatedBoundaryTopPx : null
          }
          theme={theme}
        />
        {renderRows.map((row: TimelineRenderRow) => (
          <TimelineRow
            key={row.id}
            id={row.id}
            layoutMode="flex"
            size={row.geometryMinutes}
            minHeight={row.isFinalRow ? 0 : undefined}
            onRowLayout={onRowLayout}
          >
            <TimelineRowContent
              row={toSharedTimelineRenderRow(row)}
              theme={theme}
            />
          </TimelineRow>
        ))}
        <TimelineIndicatorOverlay
          overlayIndicator={activeIndicator}
          animatedBoundaryTopPx={
            activeIndicator && boundaryTopPx !== null ? animatedBoundaryTopPx : null
          }
          blurTargetRef={blurTargetRef}
          rowLayouts={rowLayouts}
          theme={theme}
        />
      </BlurTargetView>
    </View>
  );
};

const toSharedTimelineRenderRow = (row: TimelineRenderRow) => ({
  ...row,
  displayHeightPx: row.geometryMinutes,
  startEvent: row.startBoundary,
  endEvent: row.endBoundary,
});
