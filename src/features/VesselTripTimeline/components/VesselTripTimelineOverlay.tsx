/**
 * Feature-owned overlay wrapper for VesselTrip vertical timelines.
 * This component intentionally owns measurement + absolute overlay math so the
 * generic VerticalTimeline primitive can stay simple and domain-agnostic.
 */

import ANCHOR_ICON from "assets/icons/anchor.png";
import VESSEL_ICON from "assets/icons/vessel.png";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  type TimelineRow,
  useVerticalTimelineOverlayPlacement,
  VerticalTimeline,
  VerticalTimelineIndicatorOverlay,
} from "@/components/Timeline";
import { Text, View } from "@/components/ui";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";
import { InTransitEventCard } from "./InTransitEventCard";
import { TimelineEvents } from "./TimelineEvents";
import { TimelineLabel } from "./TimelineLabel";

const MARKER_ICON_SIZE_PX = 18;

/** Kind → marker icon source (at-dock = anchor, at-sea = vessel). */
const KIND_MARKER_SOURCE: Record<VesselTripTimelineRowModel["kind"], number> = {
  "at-dock": ANCHOR_ICON,
  "at-sea": VESSEL_ICON,
};

// Layout knobs for timeline and overlay; extract to config if shared later.
const AXIS_X_RATIO = 0.5;
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
  item: VesselTripTimelineItem,
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
  if (row.rightContentKind !== "time-events" || !row.eventTimes) {
    return undefined;
  }
  return <TimelineEvents {...row.eventTimes} />;
};

/**
 * Renders a vessel-specific overlay indicator above a VerticalTimeline.
 *
 * @param props - Timeline data and domain item
 * @returns VerticalTimeline with single absolute blur-backed overlay indicator
 */
export const VesselTripTimelineOverlay = ({
  presentationRows,
  item,
}: VesselTripTimelineOverlayProps) => {
  const overlayIndicator = deriveActiveOverlayIndicator(presentationRows, item);
  const { overlayPlacement, timelineContainerProps, timelineProps } =
    useVerticalTimelineOverlayPlacement(overlayIndicator, AXIS_X_RATIO);
  const rows = presentationRows.map((row) =>
    toTimelineRow(row, item, presentationRows, overlayIndicator),
  );

  const theme = {
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
    <View className="relative h-[350px]" {...timelineContainerProps}>
      <VerticalTimeline
        rows={rows}
        theme={theme}
        className="flex-1"
        renderMode="background"
        {...timelineProps}
      />

      <VerticalTimelineIndicatorOverlay
        placement={overlayPlacement}
        indicatorSizePx={INDICATOR_SIZE_PX}
        indicatorClassName="border-2 border-green-500 bg-green-50/80"
      >
        <Text className="font-bold text-green-700 text-xs">
          {overlayIndicator.label}
        </Text>
      </VerticalTimelineIndicatorOverlay>
    </View>
  );
};

/**
 * Converts one pure presentation row into a render-ready timeline row.
 *
 * @param row - Pure presentation row data
 * @param item - Domain item containing trip and vessel data
 * @param presentationRows - All timeline rows for global position calculation
 * @param overlayIndicator - Active overlay indicator with global position
 * @returns Timeline row with feature card components
 */
const toTimelineRow = (
  row: VesselTripTimelineRowModel,
  item: VesselTripTimelineItem,
  presentationRows: VesselTripTimelineRowModel[],
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
  kind: VesselTripTimelineRowModel["kind"],
): ReactNode => {
  const source = KIND_MARKER_SOURCE[kind];
  return (
    <Image
      source={source}
      style={{ width: MARKER_ICON_SIZE_PX, height: MARKER_ICON_SIZE_PX }}
      tintColor={MARKER_TINT_COLOR}
    />
  );
};

/**
 * Calculates global percent complete for a row based on overlay indicator position.
 * Rows before the indicator row are 100% complete. Rows after are 0% complete.
 * The indicator's row shows progress based on the overlay's position percent.
 *
 * @param row - Timeline row to calculate percent for
 * @param presentationRows - All timeline rows
 * @param overlayIndicator - Active overlay indicator with global position
 * @returns Percent complete from 0 to 1 based on overlay position
 */
const getGlobalPercentComplete = (
  row: VesselTripTimelineRowModel,
  presentationRows: VesselTripTimelineRowModel[],
  overlayIndicator: OverlayIndicator,
): number => {
  const rowIndex = presentationRows.findIndex((r) => r.id === row.id);
  const indicatorRowIndex = presentationRows.findIndex(
    (r) => r.id === overlayIndicator.rowId,
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
  item: VesselTripTimelineItem,
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
        now,
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
        getTimeProgress(atDockOrigin.startTime, atDockOrigin.endTime, now),
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
        now,
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
