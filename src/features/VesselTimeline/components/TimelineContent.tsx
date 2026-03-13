/**
 * Scrollable day-level timeline content.
 *
 * The vessel-day timeline uses explicit pixel geometry, so the content view is
 * rendered at its computed full height and the scroll view simply exposes a
 * viewport into that deterministic layout.
 */

import { BlurTargetView } from "expo-blur";
import { useCallback, useEffect, useRef, useState } from "react";
import type { View as RNView } from "react-native";
import { ScrollView } from "react-native";
import {
  TimelineIndicatorOverlay,
  TimelineRow,
  TimelineRowContent,
  TimelineTrack,
  type RowLayoutBounds,
  type TimelineActiveIndicator,
  type TimelineRenderRow,
  getTrackFractions,
} from "@/components/timeline";
import { View } from "@/components/ui";
import { clamp } from "@/shared/utils";
import type { VesselTimelineRenderState } from "../types";

/**
 * Renders the full scrollable vessel-day timeline with initial auto-scroll.
 *
 * @param props - Render-ready vessel timeline state
 * @returns Scrollable vessel timeline
 */
export const TimelineContent = ({
  rows,
  activeIndicator,
  contentHeightPx,
  layout,
}: VesselTimelineRenderState) => {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const blurTargetRef = useRef<RNView | null>(null);
  const [viewportHeightPx, setViewportHeightPx] = useState(0);
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);
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

  const overlayIndicator = toTripTimelineActiveIndicator(activeIndicator, rows);
  const { completedPercent, remainingPercent } = getTrackFractions(
    activeIndicator?.topPx ?? null,
    contentHeightPx
  );

  useEffect(() => {
    if (
      hasAutoScrolled ||
      !activeIndicator ||
      layout.initialAutoScroll === "none" ||
      viewportHeightPx <= 0
    ) {
      return;
    }

    const anchorPx = viewportHeightPx * layout.initialScrollAnchorPercent;
    const targetY = Math.max(0, activeIndicator.topPx - anchorPx);

    scrollViewRef.current?.scrollTo({
      x: 0,
      y: targetY,
      animated: false,
    });
    setHasAutoScrolled(true);
  }, [activeIndicator, hasAutoScrolled, layout, viewportHeightPx]);

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 32 }}
      onLayout={(event) => {
        setViewportHeightPx(event.nativeEvent.layout.height);
      }}
    >
      <View
        className="w-full px-4"
        style={{
          minHeight: Math.max(contentHeightPx, viewportHeightPx),
        }}
      >
        <View
          className="relative w-full"
          style={{
            height: contentHeightPx,
          }}
        >
          <BlurTargetView
            ref={blurTargetRef}
            className="relative flex-1 flex-col"
            collapsable={false}
          >
            <TimelineTrack
              containerHeightPx={contentHeightPx}
              completedPercent={completedPercent}
              remainingPercent={remainingPercent}
            />
            {rows.map((row) => (
              <TimelineRow
                key={row.id}
                id={row.id}
                layoutMode="fixed"
                size={row.displayHeightPx}
                onRowLayout={onRowLayout}
              >
                <TimelineRowContent row={toSharedTimelineRenderRow(row)} />
              </TimelineRow>
            ))}
            <TimelineIndicatorOverlay
              overlayIndicator={overlayIndicator}
              blurTargetRef={blurTargetRef}
              rowLayouts={rowLayouts}
            />
          </BlurTargetView>
        </View>
      </View>
    </ScrollView>
  );
};

const toTripTimelineActiveIndicator = (
  activeIndicator: VesselTimelineRenderState["activeIndicator"],
  rows: VesselTimelineRenderState["rows"]
): TimelineActiveIndicator | null => {
  if (!activeIndicator) {
    return null;
  }

  const activeRow = rows[activeIndicator.rowIndex];
  if (!activeRow || activeRow.displayHeightPx <= 0) {
    return null;
  }

  return {
    rowId: activeIndicator.rowId,
    rowIndex: activeIndicator.rowIndex,
    positionPercent: clamp(
      (activeIndicator.topPx - activeRow.topPx) / activeRow.displayHeightPx,
      0,
      1
    ),
    label: activeIndicator.label,
  };
};

const toSharedTimelineRenderRow = (
  row: VesselTimelineRenderState["rows"][number]
): TimelineRenderRow => ({
  id: row.id,
  kind: row.kind === "dock" ? "at-dock" : "at-sea",
  segmentIndex: row.segmentIndex,
  geometryMinutes: row.displayHeightPx,
  startBoundary: row.startBoundary,
  endBoundary: row.endBoundary,
  isFinalRow: row.isTerminal === true,
});
