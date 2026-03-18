/**
 * Timeline content area: base track plus rows plus a single absolute overlay.
 * This feature intentionally renders the shared TimelineRowComponent directly
 * instead of the higher-level VerticalTimeline because the full-surface blur
 * overlay needs feature-local measurement and overlay control.
 */

import { BlurTargetView } from "expo-blur";
import { type ComponentRef, useCallback, useRef, useState } from "react";
import {
  getBoundaryTopPx,
  getTrackFractions,
  TimelineIndicatorOverlay,
  TimelineRow,
  TimelineRowContent,
  TimelineTrack,
} from "@/components/timeline";
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
  const { completedPercent, remainingPercent } = getTrackFractions(
    boundaryTopPx,
    CONTAINER_HEIGHT_PX
  );

  return (
    <View className="relative h-[350px]">
      <BlurTargetView
        ref={blurTargetRef}
        className="relative flex-1 flex-col"
        collapsable={false}
      >
        <TimelineTrack
          containerHeightPx={CONTAINER_HEIGHT_PX}
          completedPercent={completedPercent}
          remainingPercent={remainingPercent}
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
            <TimelineRowContent row={toSharedTimelineRenderRow(row)} />
          </TimelineRow>
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

const toSharedTimelineRenderRow = (row: TimelineRenderRow) => ({
  ...row,
  displayHeightPx: row.geometryMinutes,
  startBoundary: row.startBoundary,
  endBoundary: row.endBoundary,
});
