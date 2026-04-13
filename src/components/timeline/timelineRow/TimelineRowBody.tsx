/**
 * Three-column row body: end-aligned label, centered track marker, time stack.
 */

import { View } from "@/components/ui";
import { TIMELINE_ROW_CONFIG, TIMELINE_SHARED_CONFIG } from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderRow } from "../types";
import { TimelineRowLabel } from "./TimelineRowLabel";
import { TimelineRowMarker } from "./TimelineRowMarker";
import { TimelineRowTimes } from "./TimelineRowTimes";

type TimelineRowBodyProps = {
  row: TimelineRenderRow;
  theme: TimelineVisualTheme;
};

/**
 * Left label column and right times column, straddling the track marker.
 *
 * @param row - Row event/marker data used to populate all three columns
 * @param theme - Label and time styling
 * @returns Horizontal flex row with gutter offsets for the marker column
 */
const TimelineRowBody = ({ row, theme }: TimelineRowBodyProps) => (
  <View className="h-full flex-row">
    {/* Left: direction label (e.g. to/from), width matches track inset */}
    <View
      className="-translate-y-[12px] justify-start"
      style={{
        width: `${TIMELINE_SHARED_CONFIG.trackXPositionPercent}%`,
      }}
    >
      <TimelineRowLabel label={row.startLabel} theme={theme} />
    </View>
    {/* Center: disc on the shared vertical track (negative margin centers on line) */}
    <View
      className="-translate-y-[16px] items-center justify-start"
      style={{
        width: TIMELINE_ROW_CONFIG.marker.sizePx,
        marginLeft: -TIMELINE_ROW_CONFIG.marker.sizePx / 2,
      }}
    >
      <TimelineRowMarker row={row} theme={theme} />
    </View>
    {/* Right: scheduled + secondary times with per-kind icons */}
    <View className="flex-1 -translate-y-[11px] pl-2">
      <TimelineRowTimes
        point={row.startEvent.timePoint}
        showPlaceholder={row.showStartTimePlaceholder}
        theme={theme}
      />
    </View>
  </View>
);

export { TimelineRowBody };
