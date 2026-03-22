/**
 * Center track disc with dock vs sea icon and past vs future styling.
 */

import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import {
  TIMELINE_MARKER_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderRow } from "../types";
import { TimelineRowMarkerIcon } from "./TimelineRowMarkerIcon";

type TimelineRowMarkerProps = {
  row: TimelineRenderRow;
  theme: TimelineVisualTheme;
};

/**
 * Positions the circular marker on the shared track column for this row.
 *
 * @param row - Segment kind and past/future appearance
 * @param theme - Marker fill, border, and icon tint tokens
 * @returns Centered marker container with icon
 */
export const TimelineRowMarker = ({ row, theme }: TimelineRowMarkerProps) => {
  const markerColors = getMarkerColors(row.markerAppearance, theme);

  return (
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
        borderColor: markerColors.borderColor,
        backgroundColor: markerColors.fillColor,
      }}
    >
      <TimelineRowMarkerIcon
        kind={row.kind}
        markerAppearance={row.markerAppearance}
        theme={theme}
      />
    </View>
  );
};

/**
 * Resolves fill and border colors from marker appearance and theme.
 *
 * @param markerAppearance - Past vs future palette selection
 * @param theme - Marker color section
 * @returns Border and background colors for the disc
 */
const getMarkerColors = (
  markerAppearance: TimelineRenderRow["markerAppearance"],
  theme: TimelineVisualTheme
) =>
  markerAppearance === "future"
    ? {
        borderColor: theme.marker.futureBorderColor,
        fillColor: theme.marker.futureFillColor,
      }
    : {
        borderColor: theme.marker.pastBorderColor,
        fillColor: theme.marker.pastFillColor,
      };
