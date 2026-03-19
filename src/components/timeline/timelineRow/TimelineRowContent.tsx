/**
 * Shared row content for the vertical timeline renderer.
 */

import { View } from "@/components/ui";
import { TIMELINE_TRACK_X_POSITION_PERCENT } from "../config";
import {
  DEFAULT_TIMELINE_VISUAL_THEME,
  type TimelineVisualTheme,
} from "../theme";
import type { TimelineRenderRow } from "../types";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";
import { TimelineRowMarker } from "./TimelineRowMarker";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  theme?: TimelineVisualTheme;
};

export const TimelineRowContent = ({
  row,
  theme = DEFAULT_TIMELINE_VISUAL_THEME,
}: TimelineRowContentProps) => (
  <View className="relative h-full w-full">
    <View className="h-full flex-row">
      <View
        style={{
          width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
        }}
      >
        <TimelineRowEventLabel boundary={row.startBoundary} theme={theme} />
      </View>
      <View className="flex-1">
        <TimelineRowEventTimes
          point={row.startBoundary.timePoint}
          showPlaceholder={row.startBoundary.isArrivalPlaceholder === true}
          theme={theme}
        />
      </View>
    </View>
    <TimelineRowMarker row={row} theme={theme} />
  </View>
);
