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
import { BlurView } from "@/components/BlurView";
import { type TimelineRow, TimelineRowComponent } from "@/components/Timeline";
import type { RequiredTimelineTheme } from "@/components/Timeline/TimelineTypes";
import { getDurationMinutes } from "@/components/Timeline/timelineMath";
import { Text, View } from "@/components/ui";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";
import { getMarkerSourceForKind } from "../utils";
import { InTransitEventCard } from "./InTransitEventCard";
import { TimelineEvents } from "./TimelineEvents";
import { TimelineLabel } from "./TimelineLabel";

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
 * @param item - Domain item
 * @returns Left content or undefined
 */
const renderLeftContent = (
  row: VesselTripTimelineRowModel,
  item: VesselTripTimelineItem
): ReactNode => {
  switch (row.leftContentKind) {
    case "terminal-label":
      return row.terminalName ? (
        <TimelineLabel terminal={row.terminalName} />
      ) : undefined;
    case "in-transit-card":
      return <InTransitEventCard vesselLocation={item.vesselLocation} />;
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
  return <TimelineEvents {...row.eventTimeEnd} />;
};

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
    toTimelineRow(row, item, presentationRows, overlayIndicator)
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
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, styles.overlayLayer]}
        >
          {rows.map((row) => (
            <View key={`${row.id}-overlay`} style={getShadowRowStyle(row)}>
              <View style={styles.shadowSpacer} />
              <View style={styles.shadowCenter}>
                {row.id === overlayIndicator.rowId ? (
                  <View
                    style={[
                      styles.indicatorPosition,
                      {
                        top: `${overlayIndicator.positionPercent * 100}%`,
                      },
                    ]}
                  >
                    <BlurView
                      blurTarget={blurTargetRef}
                      intensity={5}
                      tint="light"
                      blurMethod="dimezisBlurView"
                      style={styles.blurIndicator}
                    >
                      <View style={styles.indicatorLabelContainer}>
                        <Text
                          className="font-bold text-green-700 text-xs"
                          style={styles.indicatorLabelText}
                        >
                          {overlayIndicator.label}
                        </Text>
                      </View>
                    </BlurView>
                  </View>
                ) : null}
              </View>
              <View style={styles.shadowSpacer} />
            </View>
          ))}
        </View>
      </BlurTargetView>
    </View>
  );
};

const styles = StyleSheet.create({
  blurTarget: {
    flex: 1,
    flexDirection: "column",
    position: "relative",
  },
  overlayLayer: {
    zIndex: 10,
    elevation: 10,
  },
  shadowRow: {
    flexDirection: "row",
  },
  shadowSpacer: {
    flex: 1,
  },
  shadowCenter: {
    width: CENTER_AXIS_SIZE_PX,
    height: "100%",
    position: "relative",
  },
  indicatorPosition: {
    position: "absolute",
    left: "50%",
    marginLeft: -INDICATOR_SIZE_PX / 2,
    marginTop: -INDICATOR_SIZE_PX / 2,
  },
  blurIndicator: {
    width: INDICATOR_SIZE_PX,
    height: INDICATOR_SIZE_PX,
    borderRadius: INDICATOR_SIZE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  indicatorLabelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorLabelText: {
    textAlign: "center",
    includeFontPadding: false,
  },
});

/**
 * Converts one pure presentation row into a render-ready timeline row.
 *
 * @param row - Pure presentation row data
 * @param item - Domain item containing trip and vessel data
 * @param presentationRows - All timeline rows for global position calculation
 * @param overlayIndicator - Active overlay indicator with row and position
 * @returns Timeline row with feature card components
 */
const toTimelineRow = (
  row: VesselTripTimelineRowModel,
  item: VesselTripTimelineItem,
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
  leftContent: renderLeftContent(row, item),
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

type OverlayIndicator = {
  rowId: string;
  positionPercent: number;
  label: string;
};

/**
 * Derives active overlay indicator from timeline rows and trip state.
 * Uses kind + position: first row = at-dock origin, second = at-sea, third = at-dock dest.
 *
 * @param rows - Timeline rows with kind boundaries and labels
 * @param item - Domain item (trip + vesselLocation) for distance-based progress
 * @returns Active overlay indicator model
 */
const deriveActiveOverlayIndicator = (
  rows: VesselTripTimelineRowModel[],
  item: VesselTripTimelineItem
): OverlayIndicator => {
  const { trip, vesselLocation } = item;
  // 3 rows: at-dock (origin), at-sea, at-dock (destination)
  const atDockOrigin = rows.find((r) => r.kind === "at-dock");
  const atSeaRow = rows.find((r) => r.kind === "at-sea");
  const atDockDest = rows.filter((r) => r.kind === "at-dock").pop();
  const now = new Date();

  // If vessel has departed from destination
  if (trip.AtDockDepartNext?.Actual && atDockDest) {
    return {
      rowId: atDockDest.id,
      positionPercent: 1,
      label: atDockDest.indicatorLabel,
    };
  }

  // If vessel has arrived at destination, show progress toward departure
  if (trip.TripEnd && atDockDest) {
    return {
      rowId: atDockDest.id,
      positionPercent: getTimeProgress(
        atDockDest.startTime,
        atDockDest.endTime,
        now
      ),
      label: atDockDest.indicatorLabel,
    };
  }

  // If vessel hasn't departed yet, show progress at dock (origin)
  if (!trip.LeftDock && atDockOrigin) {
    return {
      rowId: atDockOrigin.id,
      positionPercent: Math.max(
        0.06,
        getTimeProgress(atDockOrigin.startTime, atDockOrigin.endTime, now)
      ),
      label: atDockOrigin.indicatorLabel,
    };
  }

  // If vessel is at sea, show in-transit progress (distance-based when available)
  if (atSeaRow) {
    let positionPercent: number;
    if (
      atSeaRow.useDistanceProgress &&
      vesselLocation.DepartingDistance !== undefined &&
      vesselLocation.ArrivingDistance !== undefined &&
      vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0
    ) {
      positionPercent =
        vesselLocation.DepartingDistance /
        (vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance);
      positionPercent = clamp01(positionPercent);
    } else {
      positionPercent = getTimeProgress(
        atSeaRow.startTime,
        atSeaRow.endTime,
        now
      );
    }
    return {
      rowId: atSeaRow.id,
      positionPercent,
      label: atSeaRow.indicatorLabel,
    };
  }

  const fallbackRow = rows[0];
  return {
    rowId: fallbackRow?.id ?? "unknown-row",
    positionPercent: 0,
    label: fallbackRow?.indicatorLabel ?? "--",
  };
};

/**
 * Computes normalized elapsed progress between start and end timestamps.
 *
 * @param startTime - Start timestamp
 * @param endTime - End timestamp
 * @param now - Current time reference
 * @returns Clamped progress ratio between 0 and 1
 */
const getTimeProgress = (startTime: Date, endTime: Date, now: Date): number => {
  const duration = endTime.getTime() - startTime.getTime();
  if (duration <= 0) return 0;
  const elapsed = now.getTime() - startTime.getTime();
  return clamp01(elapsed / duration);
};

/**
 * Clamps a number to the inclusive range [0, 1].
 *
 * @param value - Raw ratio
 * @returns Clamped ratio
 */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Mirrors the timeline row sizing so the overlay tree aligns without measurement.
 *
 * @param row - Timeline row whose size should be mirrored
 * @returns View style matching the row's vertical sizing behavior
 */
const getShadowRowStyle = (row: TimelineRow) => ({
  ...styles.shadowRow,
  flexGrow: row.minHeight === 0 ? 0 : getDurationMinutes(row),
  flexBasis: "auto" as const,
  minHeight: row.minHeight ?? MIN_SEGMENT_PX,
});
