/**
 * Mirrored overlay layer for timeline indicators.
 * Paints mirrored rows above the timeline rows so the active indicator
 * can be positioned without layout measurement.
 */

import type { RefObject } from "react";
import { type View as RNView, View } from "react-native";
import type { TimelineRow } from "@/components/Timeline";
import { getDurationMinutes } from "@/components/Timeline/timelineMath";
import type { OverlayIndicator } from "../utils/deriveOverlayIndicator";
import { TimelineIndicator } from "./TimelineIndicator";

const CENTER_AXIS_SIZE_PX = 42;
const INDICATOR_SIZE_PX = 36;
const MIN_SEGMENT_PX = 32;

type TimelineIndicatorOverlayProps = {
  rows: TimelineRow[];
  overlayIndicator: OverlayIndicator;
  blurTargetRef: RefObject<RNView | null>;
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
 * Renders the overlay layer with mirrored rows and active indicator.
 *
 * @param rows - Timeline rows for sizing the mirrored rows
 * @param overlayIndicator - Active overlay indicator model
 * @param blurTargetRef - Ref to the BlurTargetView for blur effect
 * @returns Overlay view with indicator
 */
export const TimelineIndicatorOverlay = ({
  rows,
  overlayIndicator,
  blurTargetRef,
}: TimelineIndicatorOverlayProps) => (
  <View
    pointerEvents="none"
    className="absolute inset-0 z-10"
    style={{ elevation: 10 }}
  >
    {rows.map((row) => (
      <View key={`${row.id}-overlay`} style={getIndicatorRowStyle(row)}>
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
    ))}
  </View>
);
