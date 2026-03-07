/**
 * Mirrored overlay layer for timeline indicators.
 * Paints mirrored rows above the timeline rows so the active indicator
 * can be positioned without layout measurement.
 * When rowLayouts is provided for all rows, overlay rows use measured y/height
 * so the indicator aligns with the track tip.
 */

import type { RefObject } from "react";
import { type View as RNView, View } from "react-native";
import type { TimelineRow } from "@/components/Timeline";
import { getDurationMinutes } from "@/components/Timeline/timelineMath";
import type { RowLayoutBounds } from "../types";
import type { OverlayIndicator } from "../utils/deriveOverlayIndicator";
import { TimelineIndicator } from "./TimelineIndicator";

const CENTER_AXIS_SIZE_PX = 42;
const INDICATOR_SIZE_PX = 36;
const MIN_SEGMENT_PX = 32;

type TimelineIndicatorOverlayProps = {
  rows: TimelineRow[];
  overlayIndicator: OverlayIndicator;
  blurTargetRef: RefObject<RNView | null>;
  /** Measured timeline row bounds; when present for all rows, overlay rows align exactly. */
  rowLayouts?: Record<string, RowLayoutBounds>;
};

const indicatorRowStyle = { flexDirection: "row" as const };
const indicatorRowSpacerStyle = { flex: 1 };
const indicatorRowCenterStyle = {
  width: CENTER_AXIS_SIZE_PX,
  height: "100%" as const,
  position: "relative" as const,
};

const getIndicatorRowStyle = (row: TimelineRow) => ({
  ...indicatorRowStyle,
  flexGrow: row.minHeight === 0 ? 0 : getDurationMinutes(row),
  flexBasis: "auto" as const,
  minHeight: row.minHeight ?? MIN_SEGMENT_PX,
});

/**
 * Returns style for an overlay row when measured layout is available:
 * absolute position and height so the row aligns with the timeline row.
 *
 * @param layout - Measured y and height for the timeline row
 * @returns View style for absolute overlay row
 */
const getAbsoluteRowStyle = (layout: RowLayoutBounds) => ({
  position: "absolute" as const,
  left: 0,
  right: 0,
  top: layout.y,
  height: layout.height,
  flexDirection: "row" as const,
});

/**
 * Renders the overlay layer with mirrored rows and active indicator.
 * When rowLayouts has an entry for every row, overlay rows use measured
 * y/height so the indicator aligns vertically with the track tip.
 *
 * @param rows - Timeline rows for sizing the mirrored rows
 * @param overlayIndicator - Active overlay indicator model
 * @param blurTargetRef - Ref to the BlurTargetView for blur effect
 * @param rowLayouts - Optional measured row bounds for exact alignment
 * @returns Overlay view with indicator
 */
export const TimelineIndicatorOverlay = ({
  rows,
  overlayIndicator,
  blurTargetRef,
  rowLayouts = {},
}: TimelineIndicatorOverlayProps) => {
  const useMeasuredLayout =
    rows.length > 0 && rows.every((row) => rowLayouts[row.id] != null);

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 z-10"
      style={{ elevation: 10 }}
    >
      {rows.map((row) => {
        const style = useMeasuredLayout
          ? getAbsoluteRowStyle(rowLayouts[row.id] as RowLayoutBounds)
          : getIndicatorRowStyle(row);
        return (
          <View key={`${row.id}-overlay`} style={style}>
            <View style={indicatorRowSpacerStyle} />
            <View style={indicatorRowCenterStyle}>
              {row.id === overlayIndicator.rowId ? (
                <TimelineIndicator
                  blurTargetRef={blurTargetRef}
                  positionPercent={overlayIndicator.positionPercent}
                  label={overlayIndicator.label}
                  sizePx={INDICATOR_SIZE_PX}
                />
              ) : null}
            </View>
            <View style={indicatorRowSpacerStyle} />
          </View>
        );
      })}
    </View>
  );
};
