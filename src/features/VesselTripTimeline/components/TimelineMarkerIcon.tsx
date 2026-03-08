/**
 * Marker icon for timeline row kind (anchor for at-dock, vessel for at-sea).
 * Uses inline style for dimensions because NativeWind does not apply className
 * to expo-image.
 */

import ANCHOR_ICON from "assets/icons/anchor.png";
import VESSEL_ICON from "assets/icons/vessel.png";
import { Image } from "expo-image";
import type { RowKind } from "../types";

const MARKER_ICON_SIZE_PX = 18;
/** Kind → marker icon source (at-dock = anchor, at-sea = vessel). */
const KIND_MARKER_SOURCE: Record<RowKind, number> = {
  "at-dock": ANCHOR_ICON,
  "at-sea": VESSEL_ICON,
};
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
  const source = KIND_MARKER_SOURCE[kind];
  return (
    <Image
      source={source}
      style={{ width: MARKER_ICON_SIZE_PX, height: MARKER_ICON_SIZE_PX }}
      tintColor={MARKER_TINT_COLOR}
    />
  );
};
