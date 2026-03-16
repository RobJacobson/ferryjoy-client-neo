/**
 * Shared row content for the vertical timeline renderer.
 */

import { View } from "@/components/ui";
import {
  TIMELINE_CONTENT_GUTTER_PX,
  TIMELINE_MARKER_COLUMN_WIDTH_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import type { TimelineRenderRow } from "../types";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";
import { TimelineRowMarker } from "./TimelineRowMarker";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
};

const TIMELINE_SIDE_COLUMN_OFFSET_PX =
  TIMELINE_MARKER_COLUMN_WIDTH_PX / 2 + TIMELINE_CONTENT_GUTTER_PX;

export const TimelineRowContent = ({ row }: TimelineRowContentProps) => (
  <View className="relative h-full w-full">
    <View className="h-full w-full flex-row items-stretch">
      <View
        style={{
          width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
          paddingRight: TIMELINE_SIDE_COLUMN_OFFSET_PX,
        }}
      >
        <TimelineRowEventLabel boundary={row.startBoundary} />
      </View>
      <View
        className="flex-1"
        style={{
          paddingLeft: TIMELINE_SIDE_COLUMN_OFFSET_PX,
        }}
      >
        <TimelineRowEventTimes point={row.startBoundary.timePoint} />
      </View>
    </View>
    <TimelineRowMarker row={row} />
  </View>
);
