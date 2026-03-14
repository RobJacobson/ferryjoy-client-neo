/**
 * Center-column marker with icon for timeline rows.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TimelineMarkerIcon } from "./TimelineMarkerIcon";
import type { TimelineRenderRow } from "./types";

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
  <View
    className="relative justify-start"
    style={{ width: 36 }}
  >
    <View className="absolute" style={getMarkerStyle(28)}>
      <View
        className={cn(
          "items-center justify-center overflow-hidden rounded-full",
          row.markerAppearance === "future"
            ? "border border-green-500 bg-white"
            : "border border-green-200 bg-green-500"
        )}
        style={{
          width: 28,
          height: 28,
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

const getMarkerStyle = (markerSizePx: number): ViewStyle => ({
  zIndex: 1,
  ...getAbsoluteCenteredBoxStyle({
    width: markerSizePx,
    height: markerSizePx,
    isVertical: true,
  }),
});
