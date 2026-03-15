/**
 * Center-column marker with icon for timeline rows.
 */

import type { ReactNode } from "react";
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
import { TimelineMarkerIcon } from "./TimelineMarkerIcon";

type TimelineRowMarkerProps = {
  row: TimelineRenderRow;
  children?: ReactNode;
};

/**
 * Renders the center marker for a timeline row with optional custom content.
 *
 * @param row - The render row containing kind and marker appearance
 * @param children - Optional custom marker content; defaults to TimelineMarkerIcon
 * @returns The centered marker view
 */
export const TimelineRowMarker = ({
  row,
  children,
}: TimelineRowMarkerProps) => (
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
        {children ?? (
          <TimelineMarkerIcon
            kind={row.kind}
            appearance={row.markerAppearance}
          />
        )}
      </View>
    </View>
  </View>
);

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
