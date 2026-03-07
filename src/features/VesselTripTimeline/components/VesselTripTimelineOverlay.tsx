/**
 * Feature-owned overlay wrapper for VesselTrip vertical timelines.
 * Renders the timeline rows normally, then paints a mirrored shadow-row layer
 * above them for the active BlurView indicator. This preserves cross-row
 * stacking without reintroducing layout measurement.
 */

import { BlurTargetView } from "expo-blur";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { View as RNView } from "react-native";
import { StyleSheet } from "react-native";
import { type TimelineRow, TimelineRowComponent } from "@/components/Timeline";
import type { RequiredTimelineTheme } from "@/components/Timeline/TimelineTypes";
import { View } from "@/components/ui";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";
import {
  deriveActiveOverlayIndicator,
  getMarkerSourceForKind,
  type OverlayIndicator,
} from "../utils";
import { RowContentLabel } from "./RowContentLabel";
import { RowContentTimes } from "./RowContentTimes";
import { TimelineIndicatorOverlay } from "./TimelineIndicatorOverlay";

const MARKER_ICON_SIZE_PX = 18;

// Layout knobs for timeline and overlay; extract to config if shared later.
const MIN_SEGMENT_PX = 32;
const CENTER_AXIS_SIZE_PX = 42;
const TRACK_THICKNESS_PX = 8;
const MARKER_SIZE_PX = 24;
const INDICATOR_SIZE_PX = 36;

type VesselTripTimelineOverlayProps = {
  presentationRows: VesselTripTimelineRowModel[];
  item: VesselTripTimelineItem;
};

/**
 * Renders left slot content from row leftContentKind and row data.
 *
 * @param row - Timeline row model
 * @returns Left content or undefined
 */
const renderLeftContent = (row: VesselTripTimelineRowModel): ReactNode => {
  switch (row.leftContentKind) {
    case "terminal-label":
      return row.terminalName ? (
        <RowContentLabel label={row.terminalName} />
      ) : undefined;
    case "in-transit-card":
      return undefined;
    case "none":
      return undefined;
  }
};

/**
 * Renders right slot content from row rightContentKind and row data.
 *
 * @param row - Timeline row model
 * @returns Right content or undefined
 */
const renderRightContent = (row: VesselTripTimelineRowModel): ReactNode => {
  if (row.rightContentKind !== "time-events") {
    return undefined;
  }
  return <RowContentTimes {...getRightTimePoint(row)} />;
};

/**
 * Resolves the time point that should align with this row's visible marker.
 *
 * The timeline marker is rendered at the start of each row segment. For the
 * at-sea row, that start boundary is the vessel leaving dock, so the departure
 * event must come from `eventTimeStart`. The at-dock rows still render their
 * end-boundary event in the right slot.
 *
 * @param row - Timeline row model
 * @returns Time point to render beside the row marker
 */
const getRightTimePoint = (row: VesselTripTimelineRowModel) =>
  row.kind === "at-sea" ? row.eventTimeStart : row.eventTimeEnd;

/**
 * Renders vessel timeline plus a mirrored shadow-row overlay layer.
 * Rows render in normal document order, while the active BlurView indicator
 * paints in a dedicated absolute overlay tree above the full timeline.
 *
 * @param props - Timeline data and domain item
 * @returns Timeline with shadow-row BlurView indicators
 */
export const VesselTripTimelineOverlay = ({
  presentationRows,
  item,
}: VesselTripTimelineOverlayProps) => {
  const blurTargetRef = useRef<RNView | null>(null);
  const overlayIndicator = deriveActiveOverlayIndicator(presentationRows, item);
  const rows = presentationRows.map((row) =>
    toTimelineRow(row, presentationRows, overlayIndicator)
  );

  const theme: RequiredTimelineTheme = {
    minSegmentPx: MIN_SEGMENT_PX,
    centerAxisSizePx: CENTER_AXIS_SIZE_PX,
    trackThicknessPx: TRACK_THICKNESS_PX,
    markerSizePx: MARKER_SIZE_PX,
    indicatorSizePx: INDICATOR_SIZE_PX,
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
          />
        ))}
        <TimelineIndicatorOverlay
          rows={rows}
          overlayIndicator={overlayIndicator}
          blurTargetRef={blurTargetRef}
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
  row: VesselTripTimelineRowModel,
  presentationRows: VesselTripTimelineRowModel[],
  overlayIndicator: OverlayIndicator
): TimelineRow => ({
  id: row.id,
  startTime: row.startTime,
  endTime: row.endTime,
  percentComplete: getGlobalPercentComplete(
    row,
    presentationRows,
    overlayIndicator
  ),
  leftContent: renderLeftContent(row),
  rightContent: renderRightContent(row),
  markerContent: getMarkerContent(row.kind),
  minHeight: row.minHeight,
});

/** Tint applied to marker PNGs (anchor/vessel). Use tintColor on Image; className does not apply to expo-image. */
const MARKER_TINT_COLOR = "#777"; // green-800

/**
 * Returns marker content for a timeline kind (icon).
 * Uses inline style for dimensions because NativeWind does not apply
 * className to expo-image, so the icon would otherwise render at 0x0.
 *
 * @param kind - Timeline kind determining which icon to show
 * @returns Image component
 */
const getMarkerContent = (
  kind: VesselTripTimelineRowModel["kind"]
): ReactNode => {
  const source = getMarkerSourceForKind(kind);
  return (
    <Image
      source={source}
      style={{ width: MARKER_ICON_SIZE_PX, height: MARKER_ICON_SIZE_PX }}
      tintColor={MARKER_TINT_COLOR}
    />
  );
};

/**
 * Calculates global percent complete for a row based on active indicator row.
 * Rows before the indicator row are 100% complete. Rows after are 0% complete.
 * The indicator's row shows progress based on position percent.
 *
 * @param row - Timeline row to calculate percent for
 * @param presentationRows - All timeline rows
 * @param overlayIndicator - Active overlay indicator with row and position
 * @returns Percent complete from 0 to 1
 */
const getGlobalPercentComplete = (
  row: VesselTripTimelineRowModel,
  presentationRows: VesselTripTimelineRowModel[],
  overlayIndicator: OverlayIndicator
): number => {
  const rowIndex = presentationRows.findIndex((r) => r.id === row.id);
  const indicatorRowIndex = presentationRows.findIndex(
    (r) => r.id === overlayIndicator.rowId
  );

  if (indicatorRowIndex === -1) {
    return row.percentComplete;
  }

  if (rowIndex < indicatorRowIndex) {
    return 1;
  }

  if (rowIndex > indicatorRowIndex) {
    return 0;
  }

  return overlayIndicator.positionPercent;
};

const styles = StyleSheet.create({
  blurTarget: {
    flex: 1,
    flexDirection: "column",
    position: "relative",
  },
});
