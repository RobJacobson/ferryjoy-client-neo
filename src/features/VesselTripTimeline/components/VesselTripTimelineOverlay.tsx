/**
 * Feature-owned overlay wrapper for VesselTrip vertical timelines.
 * This component intentionally owns measurement + absolute overlay math so the
 * generic VerticalTimeline primitive can stay simple and domain-agnostic.
 */

import { useState } from "react";
import type { ViewStyle } from "react-native";
import { type TimelineRow, VerticalTimeline } from "@/components/Timeline";
import { Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";
import { ArriveEventCard } from "./events/ArriveEventCard";
import { DepartEventCard } from "./events/DepartEventCard";
import { InTransitEventCard } from "./events/InTransitEventCard";

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

type RowLayout = {
  // Absolute Y/height of the full row inside the timeline container.
  rowY: number;
  rowHeight: number;
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
  // Cache row measurements keyed by row id for vertical indicator placement.
  const [rowLayouts, setRowLayouts] = useState<Record<string, RowLayout>>({});
  // Timeline container width anchors horizontal indicator placement.
  const [timelineWidth, setTimelineWidth] = useState(0);
  const rows = presentationRows.map((row) => toTimelineRow(row, item));
  const overlayIndicator = getOverlayIndicator(presentationRows, item.trip);
  const overlayPlacement = getOverlayPlacement(
    overlayIndicator,
    rowLayouts,
    timelineWidth,
    axisXRatio,
  );

  return (
    <View
      className="relative"
      onLayout={(event) => {
        setTimelineWidth(event.nativeEvent.layout.width);
      }}
    >
      <VerticalTimeline
        rows={rows}
        className={className}
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
        // Row bounds provide absolute vertical placement for indicator progress.
        onRowLayout={(rowId, bounds) =>
          setRowLayouts((previous) => ({
            ...previous,
            [rowId]: {
              rowY: bounds.y,
              rowHeight: bounds.height,
            },
          }))
        }
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
  slot: "left" | "right",
  row: VesselTripTimelineRowModel,
  item: VesselTripTimelineItem,
) => {
  const { trip, vesselLocation } = item;

  if (row.phase === "transit" && slot === "left") {
    return <InTransitEventCard vesselLocation={vesselLocation} />;
  }

  if (row.phase === "departure" && slot === "right") {
    return <DepartEventCard trip={trip} vesselLocation={vesselLocation} />;
  }

  if (
    (row.phase === "transit" || row.phase === "arrival") &&
    slot === "right"
  ) {
    return (
      <ArriveEventCard
        phase={row.phase}
        trip={trip}
        vesselLocation={vesselLocation}
        rowEndTime={row.endTime}
      />
    );
  }

  return undefined;
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
const getOverlayIndicator = (
  rows: VesselTripTimelineRowModel[],
  trip: VesselTripTimelineItem["trip"],
): OverlayIndicator => {
  const departureRow = rows.find((row) => row.phase === "departure");
  const transitRow = rows.find((row) => row.phase === "transit");
  const arrivalRow = rows.find((row) => row.phase === "arrival");
  const now = new Date();

  if (trip.TripEnd && arrivalRow) {
    return {
      rowId: arrivalRow.id,
      positionPercent: 1,
      label: arrivalRow.indicatorLabel,
    };
  }

  if (!trip.LeftDock && departureRow) {
    return {
      rowId: departureRow.id,
      // Keep indicator slightly below row-start marker for readability.
      positionPercent: Math.max(
        0.06,
        getTimeProgress(departureRow.startTime, departureRow.endTime, now),
      ),
      label: departureRow.indicatorLabel,
    };
  }

  if (transitRow) {
    return {
      rowId: transitRow.id,
      positionPercent: getTimeProgress(
        transitRow.startTime,
        transitRow.endTime,
        now,
      ),
      label: transitRow.indicatorLabel,
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
 * Computes absolute overlay placement from model and measured layouts.
 *
 * @param overlayIndicator - Indicator model with row and progress
 * @param rowLayouts - Measured row layout map
 * @param timelineWidth - Measured timeline container width
 * @param axisXRatio - Horizontal anchor ratio in [0, 1]
 * @returns Absolute placement for overlay center
 */
const getOverlayPlacement = (
  overlayIndicator: OverlayIndicator,
  rowLayouts: Record<string, RowLayout>,
  timelineWidth: number,
  axisXRatio: number,
): { top: number; left: number } | undefined => {
  const rowLayout = rowLayouts[overlayIndicator.rowId];
  if (!rowLayout || rowLayout.rowHeight <= 0 || timelineWidth <= 0) {
    // Defer rendering until active row + timeline width are measured.
    return undefined;
  }
  const clampedPercent = clamp01(overlayIndicator.positionPercent);
  const clampedAxisXRatio = clamp01(axisXRatio);

  return {
    // Convert row-local progress to absolute timeline coordinates.
    top: rowLayout.rowY + rowLayout.rowHeight * clampedPercent,
    left: timelineWidth * clampedAxisXRatio,
  };
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
