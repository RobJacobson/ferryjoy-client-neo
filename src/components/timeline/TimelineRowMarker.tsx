/**
 * Center-column marker with icon for timeline rows.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TimelineMarkerIcon } from "./TimelineMarkerIcon";
import { ROW_STYLE } from "./theme";
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
    style={{ width: ROW_STYLE.centerAxisSizePx }}
  >
    <View className="absolute" style={getMarkerStyle(ROW_STYLE.markerSizePx)}>
      <View
        className={cn(
          "items-center justify-center overflow-hidden rounded-full",
          ROW_STYLE.markerAppearance[row.markerAppearance].containerClassName
        )}
        style={{
          width: ROW_STYLE.markerSizePx,
          height: ROW_STYLE.markerSizePx,
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
