/**
 * Marker icon for timeline row kind (anchor for at-dock, vessel for at-sea).
 * Uses inline style for dimensions because NativeWind does not apply className
 * to expo-image.
 */

import { Image } from "expo-image";
import type { RowKind } from "../types";
import { getMarkerSourceForKind } from "../utils";

const MARKER_ICON_SIZE_PX = 18;
/** Tint applied to marker PNGs (anchor/vessel). Use tintColor on Image; className does not apply to expo-image. */
const MARKER_TINT_COLOR = "#777"; // green-800

type TimelineMarkerIconProps = {
  kind: RowKind;
};

/**
 * Renders the marker icon for a timeline row kind.
 *
 * @param kind - Segment kind (at-dock or at-sea)
 * @returns Image component for the marker
 */
export const TimelineMarkerIcon = ({ kind }: TimelineMarkerIconProps) => {
  const source = getMarkerSourceForKind(kind);
  return (
    <Image
      source={source}
      style={{ width: MARKER_ICON_SIZE_PX, height: MARKER_ICON_SIZE_PX }}
      tintColor={MARKER_TINT_COLOR}
    />
  );
};
