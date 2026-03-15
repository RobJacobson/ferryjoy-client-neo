import { Anchor, Ship } from "lucide-react-native";
import type { TimelineMarkerAppearance, TimelineSegmentKind } from "../types";

type TimelineMarkerIconProps = {
  kind: TimelineSegmentKind;
  appearance: TimelineMarkerAppearance;
};

const markerIconColor = {
  future: "#22c55e",
  past: "#ffffff",
} as const;

export const TimelineMarkerIcon = ({
  kind,
  appearance,
}: TimelineMarkerIconProps) => {
  const Icon = kind === "at-dock" ? Anchor : Ship;

  return (
    <Icon size={20} strokeWidth={2.5} color={markerIconColor[appearance]} />
  );
};
