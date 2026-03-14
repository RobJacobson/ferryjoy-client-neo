/**
 * Shared row content for the vertical timeline renderer.
 */

import type { ReactNode } from "react";
import { View } from "@/components/ui";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";
import { TimelineRowMarker } from "./TimelineRowMarker";
import type { TimelineRenderRow } from "./types";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  markerContent?: ReactNode;
};

export const TimelineRowContent = ({
  row,
  markerContent,
}: TimelineRowContentProps) => (
  <View className="w-full flex-row items-stretch">
    <TimelineRowEventLabel label={row.startBoundary} />
    <TimelineRowMarker row={row}>{markerContent}</TimelineRowMarker>
    <TimelineRowEventTimes point={row.startBoundary.timePoint} />
  </View>
);
