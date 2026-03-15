import anchorIcon from "assets/icons/anchor.png";
import vesselIcon from "assets/icons/vessel.png";
import { Image } from "expo-image";
import type { TimelineMarkerAppearance, TimelineSegmentKind } from "../types";

type TimelineRowMarkerIconProps = {
  kind: TimelineSegmentKind;
  markerAppearance: TimelineMarkerAppearance;
};

const markerIconColor = {
  future: "#22c55eCC",
  past: "#ffffffCC",
} as const;

const markerIconSource = {
  "at-dock": anchorIcon,
  "at-sea": vesselIcon,
} as const;

export const TimelineRowMarkerIcon = ({
  kind,
  markerAppearance,
}: TimelineRowMarkerIconProps) => (
  <Image
    source={markerIconSource[kind]}
    contentFit="contain"
    style={{
      width: 20,
      height: 20,
      tintColor: markerIconColor[markerAppearance],
    }}
  />
);
