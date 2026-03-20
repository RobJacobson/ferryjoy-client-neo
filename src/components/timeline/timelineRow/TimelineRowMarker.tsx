/**
 * Center-column marker with icon for timeline rows.
 */

import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import {
  TIMELINE_MARKER_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import { BASE_TIMELINE_VISUAL_THEME, type TimelineVisualTheme } from "../theme";
import type { TimelineRenderRow } from "../types";
import { TimelineRowMarkerIcon } from "./TimelineRowMarkerIcon";

type TimelineRowMarkerProps = {
  row: TimelineRenderRow;
  theme?: TimelineVisualTheme;
};

/**
 * Renders the center marker for a timeline row.
 *
 * @param row - The render row containing kind and marker appearance
 * @returns The centered marker view
 */
export const TimelineRowMarker = ({
  row,
  theme = BASE_TIMELINE_VISUAL_THEME,
}: TimelineRowMarkerProps) => (
  <View
    className={cn(
      "absolute items-center justify-center overflow-hidden rounded-full"
    )}
    style={{
      left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
      top: 0,
      ...getAbsoluteCenteredBoxStyle({
        width: TIMELINE_MARKER_SIZE_PX,
        height: TIMELINE_MARKER_SIZE_PX,
      }),
      borderWidth: 1,
      borderColor:
        row.markerAppearance === "future"
          ? theme.marker.futureBorderColor
          : theme.marker.pastBorderColor,
      backgroundColor:
        row.markerAppearance === "future"
          ? theme.marker.futureFillColor
          : theme.marker.pastFillColor,
    }}
  >
    <TimelineRowMarkerIcon
      kind={row.kind}
      markerAppearance={row.markerAppearance}
      theme={theme}
    />
  </View>
);
