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
  getBoundaryTopPx,
  getTrackFractions,
  type RowLayoutBounds,
  TimelineIndicatorOverlay,
  TimelineRow,
  TimelineRowContent,
  TimelineTerminalCardBackgrounds,
  TimelineTrack,
} from "@/components/timeline";
import { View } from "@/components/ui";
import type { VesselTimelineRenderState } from "../types";

/**
 * Renders the full scrollable vessel-day timeline with initial auto-scroll.
 *
 * @param props - Render-ready vessel timeline state
 * @returns Scrollable vessel timeline
 */
export const TimelineContent = ({
  rows,
  terminalCards,
  activeIndicator,
  contentHeightPx,
  layout,
  theme,
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

  const indicatorTopPx = getBoundaryTopPx(activeIndicator, rowLayouts);
  const { completedPercent } = getTrackFractions(
    indicatorTopPx,
    contentHeightPx
  );

  useEffect(() => {
    if (
      hasAutoScrolled ||
      !activeIndicator ||
      layout.initialAutoScroll === "none" ||
      viewportHeightPx <= 0 ||
      indicatorTopPx === null
    ) {
      return;
    }

    const anchorPx = viewportHeightPx * layout.initialScrollAnchorPercent;
    const targetY = Math.max(0, indicatorTopPx - anchorPx);

    scrollViewRef.current?.scrollTo({
      x: 0,
      y: targetY,
      animated: false,
    });
    setHasAutoScrolled(true);
  }, [
    activeIndicator,
    hasAutoScrolled,
    indicatorTopPx,
    layout,
    viewportHeightPx,
  ]);

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1 bg-transparent"
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
            <TimelineTerminalCardBackgrounds
              cards={terminalCards}
              blurTargetRef={blurTargetRef}
              theme={theme}
            />
            <TimelineTrack
              containerHeightPx={contentHeightPx}
              completedPercent={completedPercent}
              theme={theme}
            />
            {rows.map((row, _rowIndex) => (
              <TimelineRow
                key={row.id}
                id={row.id}
                layoutMode="fixed"
                size={row.displayHeightPx}
                onRowLayout={onRowLayout}
              >
                <TimelineRowContent row={row} theme={theme} />
              </TimelineRow>
            ))}
            <TimelineIndicatorOverlay
              overlayIndicator={activeIndicator}
              blurTargetRef={blurTargetRef}
              rowLayouts={rowLayouts}
              theme={theme}
            />
          </BlurTargetView>
        </View>
      </View>
    </ScrollView>
  );
};
