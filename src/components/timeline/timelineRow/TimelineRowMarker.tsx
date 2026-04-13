/**
 * Circular track marker: dock vs sea asset and past vs future color swap.
 */

import anchorIcon from "assets/icons/anchor.png";
import vesselIcon from "assets/icons/vessel.png";
import { Image } from "expo-image";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { TIMELINE_ROW_CONFIG } from "../config";
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
const TimelineRowMarker = ({ row, theme }: TimelineRowMarkerProps) => {
  const markerColors = getMarkerColors(row.markerAppearance, theme);

  return (
    <View
      className={cn(
        "items-center justify-center overflow-hidden rounded-full border-2"
      )}
      style={{
        width: TIMELINE_ROW_CONFIG.marker.sizePx,
        height: TIMELINE_ROW_CONFIG.marker.sizePx,
        borderColor: markerColors.borderColor,
        backgroundColor: markerColors.fillColor,
      }}
    >
      <Image
        source={markerIconSource[row.kind]}
        contentFit="contain"
        style={{
          width: TIMELINE_ROW_CONFIG.marker.iconSizePx,
          height: TIMELINE_ROW_CONFIG.marker.iconSizePx,
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

export { TimelineRowMarker };
