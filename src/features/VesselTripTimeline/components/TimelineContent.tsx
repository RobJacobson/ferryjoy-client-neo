/**
 * Timeline content area: base rows (labels, track, markers) plus the
 * indicator overlay. Renders rows normally, then paints a single absolute
 * overlay indicator above them using measured row bounds for alignment.
 */

import { BlurTargetView } from "expo-blur";
import { useCallback, useRef, useState } from "react";
import type { View as RNView } from "react-native";
import { StyleSheet } from "react-native";
import { type TimelineRow, TimelineRowComponent } from "@/components/Timeline";
import type { RequiredTimelineTheme } from "@/components/Timeline/TimelineTypes";
import { View } from "@/components/ui";
import type { RowLayoutBounds, TimelineItem, TimelineRowModel } from "../types";
import {
  deriveActiveOverlayIndicator,
  getGlobalPercentComplete,
  getRightTimePoint,
  type OverlayIndicator,
} from "../utils";
import { RowContentLabel } from "./RowContentLabel";
import { RowContentTimes } from "./RowContentTimes";
import { TimelineIndicatorOverlay } from "./TimelineIndicatorOverlay";
import { TimelineMarkerIcon } from "./TimelineMarkerIcon";

type TimelineContentProps = {
  presentationRows: TimelineRowModel[];
  item: TimelineItem;
};

/**
 * Renders vessel timeline plus a single absolute indicator overlay.
 * Rows render in normal document order, while the active BlurView indicator
 * paints in a dedicated absolute overlay tree above the full timeline.
 *
 * @param props - Timeline data and domain item
 * @returns Timeline with measured-layout BlurView indicator
 */
export const TimelineContent = ({
  presentationRows,
  item,
}: TimelineContentProps) => {
  const blurTargetRef = useRef<RNView | null>(null);
  const [rowLayouts, setRowLayouts] = useState<Record<string, RowLayoutBounds>>(
    {},
  );
  const overlayIndicator = deriveActiveOverlayIndicator(presentationRows, item);
  const rows = presentationRows.map((row, rowIndex) =>
    toTimelineRow(row, rowIndex, presentationRows, overlayIndicator),
  );

  const onRowLayout = useCallback((rowId: string, bounds: RowLayoutBounds) => {
    setRowLayouts((prev) =>
      prev[rowId]?.y === bounds.y && prev[rowId]?.height === bounds.height
        ? prev
        : { ...prev, [rowId]: bounds },
    );
  }, []);

  const theme: RequiredTimelineTheme = {
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
            theme={theme}
            renderMode="background"
            isLastRow={index === rows.length - 1}
            onRowLayout={onRowLayout}
          />
        ))}
        <TimelineIndicatorOverlay
          overlayIndicator={overlayIndicator}
          blurTargetRef={blurTargetRef}
          rowLayouts={rowLayouts}
        />
      </BlurTargetView>
    </View>
  );
};

/**
 * Converts one pure presentation row into a render-ready timeline row.
 *
 * @param row - Pure presentation row data
 * @param presentationRows - All timeline rows for global position calculation
 * @param overlayIndicator - Active overlay indicator with row and position
 * @returns Timeline row with feature card components
 */
const toTimelineRow = (
  row: TimelineRowModel,
  rowIndex: number,
  presentationRows: TimelineRowModel[],
  overlayIndicator: OverlayIndicator,
): TimelineRow => ({
  id: row.id,
  startTime: row.startTime,
  endTime: row.endTime,
  percentComplete: getGlobalPercentComplete(
    row,
    presentationRows,
    overlayIndicator,
  ),
  leftContent:
    row.leftContentKind === "terminal-label" ? (
      <RowContentLabel
        terminal={row.terminalName}
        status={row.id.includes("origin") ? "depart" : "arrive"}
        past={row.percentComplete === 1}
      />
    ) : undefined,
  rightContent:
    row.rightContentKind === "time-events" ? (
      <RowContentTimes {...getRightTimePoint(row, rowIndex)} />
    ) : undefined,
  markerContent: <TimelineMarkerIcon kind={row.kind} />,
  minHeight: row.minHeight,
});

const styles = StyleSheet.create({
  blurTarget: {
    flex: 1,
    flexDirection: "column",
    position: "relative",
  },
});
