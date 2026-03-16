/**
 * Center-column marker with icon for timeline rows.
 */

import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import {
  TIMELINE_MARKER_COLUMN_WIDTH_PX,
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
    className="absolute top-0 bottom-0"
    style={{
      left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
      width: TIMELINE_MARKER_COLUMN_WIDTH_PX,
      marginLeft: -TIMELINE_MARKER_COLUMN_WIDTH_PX / 2,
    }}
  >
    <View
      className={cn(
        "items-center justify-center overflow-hidden rounded-full",
        row.markerAppearance === "future"
          ? "border border-green-500 bg-white"
          : "border border-green-200 bg-green-500"
      )}
      style={{
        zIndex: 1,
        ...getAbsoluteCenteredBoxStyle({
          width: TIMELINE_MARKER_SIZE_PX,
          height: TIMELINE_MARKER_SIZE_PX,
          isVertical: true,
        }),
      }}
    >
      <TimelineRowMarkerIcon
        kind={row.kind}
        markerAppearance={row.markerAppearance}
      />
    </View>
  </View>
);
