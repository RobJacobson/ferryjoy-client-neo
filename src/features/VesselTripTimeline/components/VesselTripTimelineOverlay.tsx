/**
 * Feature-owned overlay wrapper for VesselTrip vertical timelines.
 * This component intentionally owns measurement + absolute overlay math so the
 * generic VerticalTimeline primitive can stay simple and domain-agnostic.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { type TimelineRow, VerticalTimeline } from "@/components/Timeline";
import { Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useTimelineOverlayPlacement } from "../hooks/useTimelineOverlayPlacement";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";
import { ArriveDestLabel } from "./ArriveDestLabel";
import { ArriveDockLabel } from "./ArriveDockLabel";
import { InTransitEventCard } from "./InTransitEventCard";
import { LeaveDockLabel } from "./LeaveDockLabel";

type VesselTripTimelineOverlayProps = {
  presentationRows: VesselTripTimelineRowModel[];
  item: VesselTripTimelineItem;
  className?: string;
  rowClassName?: string;
  axisXRatio?: number;
  minSegmentPx?: number;
  centerAxisSizePx?: number;
  trackThicknessPx?: number;
  markerSizePx?: number;
  indicatorSizePx?: number;
  completeTrackClassName?: string;
  upcomingTrackClassName?: string;
  markerClassName?: string;
  indicatorClassName?: string;
};

type Slot = "left" | "right";

type SlotRendererContext = {
  row: VesselTripTimelineRowModel;
  item: VesselTripTimelineItem;
};

type SlotRenderKey = `${VesselTripTimelineRowModel["phase"]}:${Slot}`;

type SlotRenderer = (context: SlotRendererContext) => ReactNode | undefined;

const SLOT_RENDERERS: Partial<Record<SlotRenderKey, SlotRenderer>> = {
  "at-start:right": ({ item }) => (
    <ArriveDockLabel trip={item.trip} vesselLocation={item.vesselLocation} />
  ),
  "at-sea:left": ({ item }) => (
    <InTransitEventCard vesselLocation={item.vesselLocation} />
  ),
  "at-sea:right": ({ item }) => (
    <LeaveDockLabel trip={item.trip} vesselLocation={item.vesselLocation} />
  ),
  "at-dest:right": ({ item }) => (
    <ArriveDestLabel trip={item.trip} vesselLocation={item.vesselLocation} />
  ),
};

/**
 * Renders a vessel-specific overlay indicator above a VerticalTimeline.
 *
 * @param props - Timeline data, domain item, and theme settings
 * @returns VerticalTimeline with single absolute blur-backed overlay indicator
 */
export const VesselTripTimelineOverlay = ({
  presentationRows,
  item,
  className,
  rowClassName,
  axisXRatio = 0.5,
  minSegmentPx = 64,
  centerAxisSizePx = 56,
  trackThicknessPx = 8,
  markerSizePx = 18,
  indicatorSizePx = 28,
  completeTrackClassName = "bg-green-400",
  upcomingTrackClassName = "bg-green-100",
  markerClassName = "border-2 border-green-500 bg-white",
  indicatorClassName = "border-2 border-green-500 bg-green-100",
}: VesselTripTimelineOverlayProps) => {
  const overlayIndicator = deriveActiveOverlayIndicator(
    presentationRows,
    item.trip,
  );
  const { overlayPlacement, timelineContainerProps, timelineProps } =
    useTimelineOverlayPlacement(overlayIndicator, axisXRatio);
  const rows = presentationRows.map((row) => toTimelineRow(row, item));

  return (
    <View className="relative h-[400px]" {...timelineContainerProps}>
      <VerticalTimeline
        rows={rows}
        className={cn(className, "flex-1")}
        rowClassName={rowClassName}
        minSegmentPx={minSegmentPx}
        centerAxisSizePx={centerAxisSizePx}
        trackThicknessPx={trackThicknessPx}
        markerSizePx={markerSizePx}
        indicatorSizePx={indicatorSizePx}
        completeTrackClassName={completeTrackClassName}
        upcomingTrackClassName={upcomingTrackClassName}
        markerClassName={markerClassName}
        indicatorClassName={indicatorClassName}
        hideRowIndicators
        {...timelineProps}
      />

      {overlayPlacement ? (
        <View
          className="absolute"
          // Overlay should never capture touches from the timeline/cards beneath.
          pointerEvents="none"
          style={getOverlayStyle(overlayPlacement, indicatorSizePx)}
        >
          <View
            style={{ width: indicatorSizePx, height: indicatorSizePx }}
            className="relative items-center justify-center"
          >
            <View
              className={cn(
                "absolute inset-0 items-center justify-center rounded-full",
                "border-2 bg-green-100/70",
                indicatorClassName,
              )}
            >
              {/* Label is rendered over blur to preserve contrast/readability. */}
              <Text className="font-bold text-green-700 text-xs">
                {overlayIndicator.label}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

/**
 * Converts one pure presentation row into a render-ready timeline row.
 *
 * @param row - Pure presentation row data
 * @returns Timeline row with feature card components
 */
const toTimelineRow = (
  row: VesselTripTimelineRowModel,
  item: VesselTripTimelineItem,
): TimelineRow => ({
  id: row.id,
  startTime: row.startTime,
  endTime: row.endTime,
  percentComplete: row.percentComplete,
  leftContent: renderSlotContent("left", row, item),
  rightContent: renderSlotContent("right", row, item),
  indicatorContent: (
    <Text className="font-bold text-green-700 text-xs">
      {row.indicatorLabel}
    </Text>
  ),
});

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
  item: VesselTripTimelineItem,
) => {
  const key = `${row.phase}:${slot}` as SlotRenderKey;
  return SLOT_RENDERERS[key]?.({
    row,
    item,
  });
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
  trip: VesselTripTimelineItem["trip"],
): OverlayIndicator => {
  const atStartRow = rows.find((row) => row.phase === "at-start");
  const atSeaRow = rows.find((row) => row.phase === "at-sea");
  const atDestRow = rows.find((row) => row.phase === "at-dest");
  const now = new Date();

  if (trip.TripEnd && atDestRow) {
    return {
      rowId: atDestRow.id,
      positionPercent: 1,
      label: atDestRow.indicatorLabel,
    };
  }

  if (!trip.LeftDock && atStartRow) {
    return {
      rowId: atStartRow.id,
      // Keep indicator slightly below row-start marker for readability.
      positionPercent: Math.max(
        0.06,
        getTimeProgress(atStartRow.startTime, atStartRow.endTime, now),
      ),
      label: atStartRow.indicatorLabel,
    };
  }

  if (atSeaRow) {
    return {
      rowId: atSeaRow.id,
      positionPercent: getTimeProgress(
        atSeaRow.startTime,
        atSeaRow.endTime,
        now,
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
 * Builds style for absolute overlay container.
 *
 * @param placement - Absolute placement for indicator center
 * @param indicatorSizePx - Indicator diameter in pixels
 * @returns View style for overlay position
 */
const getOverlayStyle = (
  placement: { top: number; left: number },
  indicatorSizePx: number,
): ViewStyle => ({
  top: placement.top,
  left: placement.left,
  marginTop: -indicatorSizePx / 2,
  marginLeft: -indicatorSizePx / 2,
});

/**
 * Clamps a number to the inclusive range [0, 1].
 *
 * @param value - Raw ratio
 * @returns Clamped ratio
 */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
