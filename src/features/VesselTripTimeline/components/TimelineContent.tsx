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
  type OverlayIndicator,
} from "../utils";
import { getSegmentPhase } from "../utils/getSegmentPhase";
import { type BoundaryLabel, RowContentLabel } from "./RowContentLabel";
import { RowContentTimes } from "./RowContentTimes";
import { TimelineIndicatorOverlay } from "./TimelineIndicatorOverlay";
import { TimelineMarkerIcon } from "./TimelineMarkerIcon";

type TimelineContentProps = {
  presentationRows: TimelineRowModel[];
  activeSegmentIndex: number;
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
  activeSegmentIndex,
  item,
}: TimelineContentProps) => {
  const blurTargetRef = useRef<RNView | null>(null);
  const [rowLayouts, setRowLayouts] = useState<Record<string, RowLayoutBounds>>(
    {}
  );
  const overlayIndicator = deriveActiveOverlayIndicator(
    presentationRows,
    activeSegmentIndex,
    item
  );
  const rows = presentationRows.map((row) =>
    toTimelineRow(row, activeSegmentIndex, overlayIndicator)
  );

  const onRowLayout = useCallback((rowId: string, bounds: RowLayoutBounds) => {
    setRowLayouts((prev) =>
      prev[rowId]?.y === bounds.y && prev[rowId]?.height === bounds.height
        ? prev
        : { ...prev, [rowId]: bounds }
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
 * @param segmentCount - Total number of segments in the ordered list
 * @param activeSegmentIndex - Active segment cursor for the ordered list
 * @param overlayIndicator - Active overlay indicator with row and position
 * @returns Timeline row with feature card components
 */
const toTimelineRow = (
  row: TimelineRowModel,
  activeSegmentIndex: number,
  overlayIndicator: OverlayIndicator
): TimelineRow => {
  const globalPercentComplete = getGlobalPercentComplete(row, overlayIndicator);

  return {
    id: row.id,
    durationMinutes: row.durationMinutes,
    percentComplete: globalPercentComplete,
    leftContent: (
      <RowContentLabel
        startLabel={getStartBoundaryLabel(row, activeSegmentIndex)}
        endLabel={row.rendersEndLabel ? getEndBoundaryLabel(row) : undefined}
      />
    ),
    rightContent: (
      <RowContentTimes
        startPoint={row.startPoint}
        endPoint={row.rendersEndLabel ? row.endPoint : undefined}
      />
    ),
    markerContent: <TimelineMarkerIcon kind={row.kind} />,
    minHeight: row.minHeight,
  };
};

/**
 * Builds the top boundary label for a presentation row.
 *
 * @param row - Presentation row derived from a segment
 * @param activeSegmentIndex - Active segment cursor for the ordered list
 * @returns Boundary label copy plus terminal abbreviation
 */
const getStartBoundaryLabel = (
  row: TimelineRowModel,
  activeSegmentIndex: number
): BoundaryLabel => {
  const phase = getSegmentPhase(row.segmentIndex, activeSegmentIndex);

  if (row.kind === "at-dock") {
    return {
      label: phase === "upcoming" ? "Arriving" : "Arrived",
      terminalAbbrev: row.startTerminalAbbrev,
    };
  }

  return {
    label: phase === "upcoming" ? "Departing to" : "Departed to",
    terminalAbbrev: row.endTerminalAbbrev,
  };
};

/**
 * Builds the optional bottom boundary label for the final row.
 *
 * @param row - Presentation row derived from a segment
 * @returns Future-facing end boundary label
 */
const getEndBoundaryLabel = (row: TimelineRowModel): BoundaryLabel => ({
  label: row.kind === "at-dock" ? "Departing to" : "Arriving",
  terminalAbbrev: row.endTerminalAbbrev,
});

const styles = StyleSheet.create({
  blurTarget: {
    flex: 1,
    flexDirection: "column",
    position: "relative",
  },
});
