/**
 * Timeline content area: base rows plus a single absolute overlay indicator.
 * This feature intentionally renders `TimelineRowComponent` directly instead of
 * the higher-level `VerticalTimeline` because the full-surface blur overlay
 * needs feature-local measurement and overlay control.
 */

import { BlurTargetView } from "expo-blur";
import { useCallback, useRef, useState } from "react";
import type { View as RNView } from "react-native";
import { StyleSheet } from "react-native";
import { type TimelineRow, TimelineRowComponent } from "@/components/Timeline";
import type { RequiredTimelineTheme } from "@/components/Timeline/TimelineTypes";
import { View } from "@/components/ui";
import type {
  RowLayoutBounds,
  TimelineRenderRow,
  TimelineRenderState,
} from "../types";
import { RowContentLabel } from "./RowContentLabel";
import { RowContentTimes } from "./RowContentTimes";
import { TimelineIndicatorOverlay } from "./TimelineIndicatorOverlay";
import { TimelineMarkerIcon } from "./TimelineMarkerIcon";

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

/**
 * Renders vessel timeline rows plus a single absolute indicator overlay.
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
  const rows = renderRows.map(toTimelineRow);

  const onRowLayout = useCallback((rowId: string, bounds: RowLayoutBounds) => {
    setRowLayouts((prev) =>
      prev[rowId]?.y === bounds.y && prev[rowId]?.height === bounds.height
        ? prev
        : { ...prev, [rowId]: bounds }
    );
  }, []);

  return (
    <View className="relative h-[350px]">
      <BlurTargetView
        ref={blurTargetRef}
        style={styles.blurTarget}
        collapsable={false}
      >
        {rows.map((row, index) => (
          <TimelineRowComponent
            key={row.id}
            row={row}
            theme={TIMELINE_THEME}
            renderMode="background"
            isLastRow={index === rows.length - 1}
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

/**
 * Converts one render-ready row into the shared timeline primitive shape.
 *
 * @param row - Render-ready row state
 * @returns Shared timeline row with feature-specific slots
 */
const toTimelineRow = (row: TimelineRenderRow): TimelineRow => ({
  id: row.id,
  durationMinutes: row.geometryMinutes,
  percentComplete: row.percentComplete,
  leftContent: (
    <RowContentLabel
      startLabel={row.startBoundary}
      endLabel={row.endBoundary}
    />
  ),
  rightContent: (
    <RowContentTimes
      startPoint={row.startBoundary.timePoint}
      endPoint={row.endBoundary?.timePoint}
    />
  ),
  markerContent: <TimelineMarkerIcon kind={row.kind} />,
  minHeight: row.layoutMode === "content" ? 0 : undefined,
});

const styles = StyleSheet.create({
  blurTarget: {
    flex: 1,
    flexDirection: "column",
    position: "relative",
  },
});
