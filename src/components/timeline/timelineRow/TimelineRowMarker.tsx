/**
 * Center-column marker with icon for timeline rows.
 */

import anchorIcon from "assets/icons/anchor.png";
import vesselIcon from "assets/icons/vessel.png";
import { Image } from "expo-image";
import type { ViewStyle } from "react-native";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import {
  TIMELINE_MARKER_COLUMN_WIDTH_PX,
  TIMELINE_MARKER_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import type { TimelineRenderRow } from "../types";

type TimelineRowMarkerProps = {
  row: TimelineRenderRow;
};

/**
 * Renders the center marker for a timeline row.
 *
 * @param row - The render row containing kind and marker appearance
 * @returns The centered marker view
 */
export const TimelineRowMarker = ({ row }: TimelineRowMarkerProps) => (
  <View className="absolute top-0 bottom-0" style={getMarkerColumnStyle()}>
    <View className="absolute" style={getMarkerStyle(28)}>
      <View
        className={cn(
          "items-center justify-center overflow-hidden rounded-full",
          row.markerAppearance === "future"
            ? "border border-green-500 bg-white"
            : "border border-green-200 bg-green-500"
        )}
        style={{
          width: TIMELINE_MARKER_SIZE_PX,
          height: TIMELINE_MARKER_SIZE_PX,
        }}
      >
        <Image
          source={markerIconSource[row.kind]}
          contentFit="contain"
          style={{
            width: 20,
            height: 20,
            tintColor: markerIconColor[row.markerAppearance],
          }}
        />
      </View>
    </View>
  </View>
);

const markerIconColor = {
  future: "#22c55eCC",
  past: "#ffffffCC",
} as const;

const markerIconSource = {
  "at-dock": anchorIcon,
  "at-sea": vesselIcon,
} as const;

const getMarkerColumnStyle = (): ViewStyle => ({
  left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
  width: TIMELINE_MARKER_COLUMN_WIDTH_PX,
  marginLeft: -TIMELINE_MARKER_COLUMN_WIDTH_PX / 2,
});

const getMarkerStyle = (markerSizePx: number): ViewStyle => ({
  zIndex: 1,
  ...getAbsoluteCenteredBoxStyle({
    width: markerSizePx,
    height: markerSizePx,
    isVertical: true,
  }),
});
