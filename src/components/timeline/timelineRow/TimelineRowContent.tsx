/**
 * Shared row content for the vertical timeline renderer.
 */

import { View } from "@/components/ui";
import { TIMELINE_TRACK_X_POSITION_PERCENT } from "../config";
import { BASE_TIMELINE_VISUAL_THEME, type TimelineVisualTheme } from "../theme";
import type { TimelineRenderRow } from "../types";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";
import { TimelineRowMarker } from "./TimelineRowMarker";
import { TimelineRowTerminalHeadline } from "./TimelineRowTerminalHeadline";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  theme?: TimelineVisualTheme;
};

export const TimelineRowContent = ({
  row,
  theme = BASE_TIMELINE_VISUAL_THEME,
}: TimelineRowContentProps) => (
  <View className="relative h-full w-full">
    <TimelineRowTerminalHeadline event={row.startEvent} theme={theme} />
    <View className="h-full flex-row">
      <View
        style={{
          width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
        }}
      >
        <TimelineRowEventLabel event={row.startEvent} theme={theme} />
      </View>
      <View className="flex-1">
        <TimelineRowEventTimes
          point={row.startEvent.timePoint}
          showPlaceholder={row.startEvent.isArrivalPlaceholder === true}
          theme={theme}
        />
      </View>
    </View>
    <TimelineRowMarker row={row} theme={theme} />
  </View>
);
