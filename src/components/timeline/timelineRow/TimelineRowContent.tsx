/**
 * Shared row content for the vertical timeline renderer.
 */

import { View } from "@/components/ui";
import { TIMELINE_TRACK_X_POSITION_PERCENT } from "../config";
import type { TimelineRenderRow } from "../types";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";
import { TimelineRowMarker } from "./TimelineRowMarker";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
};

export const TimelineRowContent = ({ row }: TimelineRowContentProps) => (
  <View className="relative h-full w-full">
    <View className="h-full flex-row">
      <View
        style={{
          width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
        }}
      >
        <TimelineRowEventLabel boundary={row.startBoundary} />
      </View>
      <View className="flex-1">
        <TimelineRowEventTimes
          point={row.startBoundary.timePoint}
          showPlaceholder={row.startBoundary.isArrivalPlaceholder === true}
        />
      </View>
    </View>
    <TimelineRowMarker row={row} />
  </View>
);
