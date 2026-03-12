/**
 * Timeline content area: base track plus rows plus a single absolute overlay.
 * This feature intentionally renders the shared TimelineRowComponent directly
 * instead of the higher-level VerticalTimeline because the full-surface blur
 * overlay needs feature-local measurement and overlay control.
 */

import { BlurTargetView } from "expo-blur";
import { useCallback, useRef, useState } from "react";
import type { View as RNView } from "react-native";
import { View } from "@/components/ui";
import { clamp } from "@/shared/utils";
import type {
  RowLayoutBounds,
  TimelineActiveIndicator,
  TimelineRenderRow,
  TimelineRenderState,
} from "../types";
import { TimelineIndicatorOverlay } from "./TimelineIndicatorOverlay";
import { TimelineRow } from "./TimelineRow";
import { TimelineRowContentLabel } from "./TimelineRowContentLabel";
import { RowContentTimes } from "./TimelineRowContentTimes";
import { TimelineTrack } from "./TimelineTrack";

const CONTAINER_HEIGHT_PX = 350;

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

  return (
    <View className="relative h-[350px]">
      <BlurTargetView
        ref={blurTargetRef}
        className="relative flex-1 flex-col"
        collapsable={false}
      >
        <TimelineTrack
          containerHeightPx={CONTAINER_HEIGHT_PX}
          boundaryTopPx={boundaryTopPx}
        />
        {renderRows.map((row: TimelineRenderRow) => (
          <TimelineRow
            key={row.id}
            id={row.id}
            durationMinutes={row.geometryMinutes}
            minHeight={row.isFinalRow ? 0 : undefined}
            onRowLayout={onRowLayout}
            leftContent={
              <TimelineRowContentLabel startLabel={row.startBoundary} />
            }
            rightContent={
              <RowContentTimes startPoint={row.startBoundary.timePoint} />
            }
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
