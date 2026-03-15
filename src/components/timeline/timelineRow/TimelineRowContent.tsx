/**
 * Shared row content for the vertical timeline renderer.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
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
  markerContent?: ReactNode;
};

export const TimelineRowContent = ({
  row,
  markerContent,
}: TimelineRowContentProps) => (
  <View className="relative h-full w-full">
    <View className="h-full w-full flex-row items-stretch">
      <View style={getLeadingContentStyle()}>
        <TimelineRowEventLabel label={row.startBoundary} />
      </View>
      <View style={getTrailingContentStyle()}>
        <TimelineRowEventTimes point={row.startBoundary.timePoint} />
      </View>
    </View>
    <TimelineRowMarker row={row}>{markerContent}</TimelineRowMarker>
  </View>
);

const getLeadingContentStyle = (): ViewStyle => ({
  width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
  paddingRight:
    TIMELINE_MARKER_COLUMN_WIDTH_PX / 2 + TIMELINE_CONTENT_GUTTER_PX,
});

const getTrailingContentStyle = (): ViewStyle => ({
  flex: 1,
  paddingLeft:
    TIMELINE_MARKER_COLUMN_WIDTH_PX / 2 + TIMELINE_CONTENT_GUTTER_PX,
});
