/**
 * Center-column marker with icon for timeline rows.
 */

import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  TIMELINE_MARKER_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import type { TimelineRenderRow } from "../types";
import { TimelineRowMarkerIcon } from "./TimelineRowMarkerIcon";

type TimelineRowMarkerProps = {
  row: TimelineRenderRow;
};

/**
 * Renders the center marker for a timeline row.
 *
 * @param row - The render row containing kind and marker appearance
 * @returns The centered marker view
 */
export const TimelineRowMarker = ({ row }: TimelineRowMarkerProps) => (
  <View
    className={cn(
      "absolute items-center justify-center overflow-hidden rounded-full",
      row.markerAppearance === "future"
        ? "border border-green-500 bg-white"
        : "border border-green-200 bg-green-500"
    )}
    style={{
      top: 0,
      left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
      width: TIMELINE_MARKER_SIZE_PX,
      height: TIMELINE_MARKER_SIZE_PX,
      marginTop: -TIMELINE_MARKER_SIZE_PX / 2,
      marginLeft: -TIMELINE_MARKER_SIZE_PX / 2,
    }}
  >
    <TimelineRowMarkerIcon
      kind={row.kind}
      markerAppearance={row.markerAppearance}
    />
  </View>
);
