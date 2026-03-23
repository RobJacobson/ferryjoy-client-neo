/**
 * Center track disc with dock vs sea icon and past vs future styling.
 */

import anchorIcon from "assets/icons/anchor.png";
import vesselIcon from "assets/icons/vessel.png";
import { Image } from "expo-image";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import {
  TIMELINE_MARKER_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderRow } from "../types";

type TimelineRowMarkerProps = {
  row: TimelineRenderRow;
  theme: TimelineVisualTheme;
};

const markerIconSource = {
  "at-dock": anchorIcon,
  "at-sea": vesselIcon,
} as const;

/**
 * Positions the circular marker on the shared track column for this row.
 *
 * @param row - Segment kind and past/future appearance
 * @param theme - Marker accent/contrast tokens
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
        borderWidth: 2,
        borderColor: markerColors.borderColor,
        backgroundColor: markerColors.fillColor,
      }}
    >
      <Image
        source={markerIconSource[row.kind]}
        contentFit="contain"
        style={{
          width: 20,
          height: 20,
          tintColor: markerColors.iconTintColor,
        }}
      />
    </View>
  );
};

/**
 * Resolves fill and border colors from marker appearance and theme.
 *
 * Past and future are a simple swap of the same two colors:
 * future = [accent, contrast, accent]
 * past = [contrast, accent, contrast]
 *
 * @param markerAppearance - Past vs future palette selection
 * @param theme - Marker color section
 * @returns Border, background, and icon colors for the disc
 */
const getMarkerColors = (
  markerAppearance: TimelineRenderRow["markerAppearance"],
  theme: TimelineVisualTheme
) =>
  markerAppearance === "future"
    ? {
        borderColor: theme.marker.accentColor,
        fillColor: theme.marker.contrastColor,
        iconTintColor: theme.marker.accentColor,
      }
    : {
        borderColor: theme.marker.contrastColor,
        fillColor: theme.marker.accentColor,
        iconTintColor: theme.marker.contrastColor,
      };
