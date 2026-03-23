/**
 * Label and times columns for a timeline row, aligned around the track marker.
 */

import { View } from "@/components/ui";
import { TIMELINE_ROW_CONFIG, TIMELINE_SHARED_CONFIG } from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderEvent } from "../types";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";

type TimelineRowBodyProps = {
  label: string;
  point: TimelineRenderEvent["timePoint"];
  showPlaceholder: boolean;
  theme: TimelineVisualTheme;
};

/**
 * Left label column and right times column, straddling the track marker.
 *
 * @param label - Short arrive/depart line from `getStartEventDisplay`
 * @param point - Scheduled / actual / estimated times for the start event
 * @param showPlaceholder - When true, may show a time placeholder
 * @param theme - Label and time styling
 * @returns Horizontal flex row with gutter offsets for the marker column
 */
export const TimelineRowBody = ({
  label,
  point,
  showPlaceholder,
  theme,
}: TimelineRowBodyProps) => (
  <View className="mt-[-10px] h-full flex-row">
    {/* Left column */}
    <View
      style={{
        width: `${TIMELINE_SHARED_CONFIG.trackXPositionPercent}%`,
      }}
    >
      <View
        className="flex-row justify-end"
        style={{
          marginRight:
            TIMELINE_SHARED_CONFIG.sideColumnOffsetPx +
            TIMELINE_ROW_CONFIG.body.contentNudgePx,
        }}
      >
        <TimelineRowEventLabel label={label} theme={theme} />
      </View>
    </View>
    {/* Right column */}
    <View
      className="flex-1"
      style={{
        marginLeft:
          TIMELINE_SHARED_CONFIG.sideColumnOffsetPx +
          TIMELINE_ROW_CONFIG.body.contentNudgePx,
      }}
    >
      <TimelineRowEventTimes
        point={point}
        showPlaceholder={showPlaceholder}
        theme={theme}
      />
    </View>
  </View>
);
