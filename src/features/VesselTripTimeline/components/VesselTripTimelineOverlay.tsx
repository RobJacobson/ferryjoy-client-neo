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
import { getPredictedArriveNextTime } from "@/features/TimelineFeatures/shared/utils";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";
import { InTransitEventCard } from "./InTransitEventCard";
import { TimelineEvents } from "./TimelineEvents";
import { TimelineLabel } from "./TimelineLabel";

const MARKER_ICON_SIZE_PX = 24;

/** Phase → marker icon source; phases not listed (e.g. depart-dest) have no icon. */
const PHASE_MARKER_SOURCE: Partial<
  Record<VesselTripTimelineRowModel["phase"], number>
> = {
  "at-start": ANCHOR_ICON,
  "at-dest": ANCHOR_ICON,
  "at-sea": VESSEL_ICON,
  "depart-dest": VESSEL_ICON,
};

// Layout knobs for timeline and overlay; extract to config if shared later.
const AXIS_X_RATIO = 0.5;
const MIN_SEGMENT_PX = 32;
const CENTER_AXIS_SIZE_PX = 56;
const TRACK_THICKNESS_PX = 8;
const MARKER_SIZE_PX = 40;
const INDICATOR_SIZE_PX = 36;

type VesselTripTimelineOverlayProps = {
  presentationRows: VesselTripTimelineRowModel[];
  item: VesselTripTimelineItem;
};

type Slot = "left" | "right";

type SlotRendererContext = {
  row: VesselTripTimelineRowModel;
  item: VesselTripTimelineItem;
};

type SlotRenderKey = `${VesselTripTimelineRowModel["phase"]}:${Slot}`;

type SlotRenderer = (context: SlotRendererContext) => ReactNode | undefined;

const SLOT_RENDERERS: Partial<Record<SlotRenderKey, SlotRenderer>> = {
  "at-start:left": ({ item }) => (
    <TimelineLabel terminal={item.vesselLocation.DepartingTerminalName} />
  ),
  "at-start:right": ({ item }) => (
    <TimelineEvents
      actualTime={item.trip.TripStart}
      scheduledTime={item.trip.ScheduledTrip?.SchedArriveCurr}
    />
  ),
  "at-sea:left": ({ item }) => (
    <InTransitEventCard vesselLocation={item.vesselLocation} />
  ),
  "at-sea:right": ({ item }) => (
    <TimelineEvents
      actualTime={item.trip.LeftDock}
      scheduledTime={item.trip.ScheduledDeparture}
      predictedTime={item.trip.AtDockDepartCurr?.PredTime}
    />
  ),
  "at-dest:left": ({ item }) => (
    <TimelineLabel terminal={item.vesselLocation.ArrivingTerminalName} />
  ),
  "at-dest:right": ({ item }) => (
    <TimelineEvents
      actualTime={item.trip.TripEnd}
      scheduledTime={item.trip.ScheduledTrip?.SchedArriveNext}
      predictedTime={getPredictedArriveNextTime(item.trip, item.vesselLocation)}
    />
  ),
  "depart-dest:left": ({ item }) => (
    <TimelineLabel terminal={item.vesselLocation.ArrivingTerminalName} />
  ),
  "depart-dest:right": ({ item }) => (
    <TimelineEvents
      predictedTime={
        item.trip.AtSeaDepartNext?.PredTime ??
        item.trip.AtDockDepartNext?.PredTime
      }
      scheduledTime={item.trip.ScheduledTrip?.NextDepartingTime}
    />
  ),
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
  const overlayIndicator = deriveActiveOverlayIndicator(
    presentationRows,
    item.trip
  );
  const { overlayPlacement, timelineContainerProps, timelineProps } =
    useVerticalTimelineOverlayPlacement(overlayIndicator, AXIS_X_RATIO);
  const rows = presentationRows.map((row) =>
    toTimelineRow(row, item, presentationRows, overlayIndicator)
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
  leftContent: renderSlotContent("left", row, item),
  rightContent: renderSlotContent("right", row, item),
  markerContent: getMarkerContent(row.phase),
  minHeight: row.phase === "depart-dest" ? 0 : undefined,
});

/**
 * Returns marker content for a timeline phase (icon or nothing).
 * Uses inline style for dimensions because NativeWind does not apply
 * className to expo-image, so the icon would otherwise render at 0x0.
 *
 * @param phase - Timeline phase determining which icon to show
 * @returns Image component or undefined for phases without a marker icon
 */
const getMarkerContent = (
  phase: VesselTripTimelineRowModel["phase"]
): ReactNode => {
  const source = PHASE_MARKER_SOURCE[phase];
  if (!source) return undefined;
  return (
    <Image
      source={source}
      style={{ width: MARKER_ICON_SIZE_PX, height: MARKER_ICON_SIZE_PX }}
    />
  );
};

/**
 * Renders a slot's content from row phase and domain item data.
 *
 * @param slot - Timeline slot side
 * @param row - Timeline row model
 * @param item - Domain item containing trip and vessel data
 * @returns Feature card component or undefined
 */
const renderSlotContent = (
  slot: Slot,
  row: VesselTripTimelineRowModel,
  item: VesselTripTimelineItem
) => {
  const key = `${row.phase}:${slot}` as SlotRenderKey;
  return SLOT_RENDERERS[key]?.({
    row,
    item,
  });
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
 *
 * @param rows - Timeline rows with phase boundaries and labels
 * @param trip - Trip state used to select active phase
 * @returns Active overlay indicator model
 */
const deriveActiveOverlayIndicator = (
  rows: VesselTripTimelineRowModel[],
  trip: VesselTripTimelineItem["trip"]
): OverlayIndicator => {
  const atStartRow = rows.find((row) => row.phase === "at-start");
  const atSeaRow = rows.find((row) => row.phase === "at-sea");
  const _atDestRow = rows.find((row) => row.phase === "at-dest");
  const departDestRow = rows.find((row) => row.phase === "depart-dest");
  const now = new Date();

  // If vessel has departed from destination (card would change, but handle just in case)
  if (trip.AtDockDepartNext?.Actual && departDestRow) {
    return {
      rowId: departDestRow.id,
      positionPercent: 1,
      label: departDestRow.indicatorLabel,
    };
  }

  // If vessel has arrived at destination, show progress toward departure
  if (trip.TripEnd && departDestRow) {
    return {
      rowId: departDestRow.id,
      positionPercent: getTimeProgress(
        departDestRow.startTime,
        departDestRow.endTime,
        now
      ),
      label: departDestRow.indicatorLabel,
    };
  }

  // If vessel hasn't departed yet, show progress at dock
  if (!trip.LeftDock && atStartRow) {
    return {
      rowId: atStartRow.id,
      // Keep indicator slightly below row-start marker for readability.
      positionPercent: Math.max(
        0.06,
        getTimeProgress(atStartRow.startTime, atStartRow.endTime, now)
      ),
      label: atStartRow.indicatorLabel,
    };
  }

  // If vessel is at sea, show in-transit progress
  if (atSeaRow) {
    return {
      rowId: atSeaRow.id,
      positionPercent: getTimeProgress(
        atSeaRow.startTime,
        atSeaRow.endTime,
        now
      ),
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
