/**
 * Dock anchor vs sea vessel glyph inside the timeline row marker.
 */

import anchorIcon from "assets/icons/anchor.png";
import vesselIcon from "assets/icons/vessel.png";
import { Image } from "expo-image";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineMarkerAppearance, TimelineSegmentKind } from "../types";

type TimelineRowMarkerIconProps = {
  kind: TimelineSegmentKind;
  markerAppearance: TimelineMarkerAppearance;
  theme: TimelineVisualTheme;
};

const markerIconSource = {
  "at-dock": anchorIcon,
  "at-sea": vesselIcon,
} as const;

/**
 * Raster icon tinted for past or future marker state.
 *
 * @param kind - At-dock (anchor) vs at-sea (vessel) artwork
 * @param markerAppearance - Selects past vs future icon tint
 * @param theme - Icon tint tokens from the visual theme
 * @returns Sized `Image` for the marker interior
 */
export const TimelineRowMarkerIcon = ({
  kind,
  markerAppearance,
  theme,
}: TimelineRowMarkerIconProps) => (
  <Image
    source={markerIconSource[kind]}
    contentFit="contain"
    style={{
      width: 20,
      height: 20,
      tintColor:
        markerAppearance === "future"
          ? theme.marker.futureIconTintColor
          : theme.marker.pastIconTintColor,
    }}
  />
);
