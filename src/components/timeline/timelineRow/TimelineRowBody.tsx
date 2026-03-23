/**
 * Label and times columns for a timeline row, aligned around the track marker.
 */

import { View } from "@/components/ui";
import {
  TIMELINE_SIDE_COLUMN_OFFSET_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderEvent } from "../types";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";

const TIMELINE_ROW_CONTENT_NUDGE_PX = 2;

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
        width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
      }}
    >
      <View
        className="flex-row justify-end"
        style={{
          marginRight:
            TIMELINE_SIDE_COLUMN_OFFSET_PX + TIMELINE_ROW_CONTENT_NUDGE_PX,
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
          TIMELINE_SIDE_COLUMN_OFFSET_PX + TIMELINE_ROW_CONTENT_NUDGE_PX,
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
