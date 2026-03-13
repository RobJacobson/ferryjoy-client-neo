/**
 * Marker icon for timeline row kind.
 */

import ANCHOR_ICON from "assets/icons/anchor.png";
import VESSEL_ICON from "assets/icons/vessel.png";
import { Image } from "expo-image";
import type { TimelineSegmentKind } from "./types";

const MARKER_ICON_SIZE_PX = 18;
const KIND_MARKER_SOURCE: Record<TimelineSegmentKind, number> = {
  "at-dock": ANCHOR_ICON,
  "at-sea": VESSEL_ICON,
};
const MARKER_TINT_COLOR = "#999";

type TimelineMarkerIconProps = {
  kind: TimelineSegmentKind;
};

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
