/**
 * Marker icon for timeline row kind.
 */

import ANCHOR_ICON from "assets/icons/anchor.png";
import VESSEL_ICON from "assets/icons/vessel.png";
import { Image } from "expo-image";
import type { TimelineSegmentKind } from "./types";
import { ROW_STYLE } from "./theme";

const MARKER_ICON_SIZE_PX = 18;
const KIND_MARKER_SOURCE: Record<TimelineSegmentKind, number> = {
  "at-dock": ANCHOR_ICON,
  "at-sea": VESSEL_ICON,
};
type TimelineMarkerIconProps = {
  kind: TimelineSegmentKind;
  appearance: "past" | "future";
};

export const TimelineMarkerIcon = ({
  kind,
  appearance,
}: TimelineMarkerIconProps) => {
  const source = KIND_MARKER_SOURCE[kind];
  return (
    <Image
      source={source}
      style={{ width: MARKER_ICON_SIZE_PX, height: MARKER_ICON_SIZE_PX }}
      tintColor={ROW_STYLE.markerAppearance[appearance].iconTintColor}
    />
  );
};
