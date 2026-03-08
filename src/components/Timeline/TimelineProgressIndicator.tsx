/**
 * Inline progress indicator for timeline tracks.
 * Returns null when the indicator should not render for the current progress.
 */

import type { ReactNode } from "react";
import { type DimensionValue, View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TimelineMarker } from "./TimelineMarker";

const INDICATOR_Z_INDEX = 2;

type TimelineProgressIndicatorProps = {
  isVertical: boolean;
  percentComplete: number;
  showIndicator?: boolean;
  showTrack?: boolean;
  indicatorSizePx: number;
  indicatorClassName: string;
  indicatorContent?: ReactNode;
};

/**
 * Renders the inline progress indicator when the current segment is in progress.
 *
 * @param isVertical - Orientation flag determining axis direction
 * @param percentComplete - Progress ratio from 0 to 1
 * @param showIndicator - Whether inline indicators are enabled
 * @param showTrack - Whether the track is visible for this row
 * @param indicatorSizePx - Indicator diameter in pixels
 * @param indicatorClassName - Theme classes for the indicator marker
 * @param indicatorContent - Optional content rendered inside the indicator
 * @returns Inline indicator view or null when the row is not in progress
 */
export const TimelineProgressIndicator = ({
  isVertical,
  percentComplete,
  showIndicator = true,
  showTrack = true,
  indicatorSizePx,
  indicatorClassName,
  indicatorContent,
}: TimelineProgressIndicatorProps) => {
  if (
    !showTrack ||
    !showIndicator ||
    percentComplete <= 0 ||
    percentComplete >= 1
  ) {
    return null;
  }

  const completedPercent: DimensionValue = `${percentComplete * 100}%`;

  return (
    <View
      className={cn("absolute")}
      style={getIndicatorStyle(isVertical, indicatorSizePx, completedPercent)}
    >
      <TimelineMarker sizePx={indicatorSizePx} className={indicatorClassName}>
        {indicatorContent}
      </TimelineMarker>
    </View>
  );
};

/**
 * Returns style props for the moving progress indicator dot.
 *
 * The indicator is positioned along the track at the progress point and
 * centered on the track axis via negative margins.
 *
 * @param isVertical - Orientation flag determining axis direction
 * @param indicatorSizePx - Indicator diameter in pixels for centering
 * @returns View style for indicator dot container
 */
const getIndicatorStyle = (
  isVertical: boolean,
  indicatorSizePx: number,
  completedPercent: DimensionValue
): ViewStyle => ({
  top: isVertical ? completedPercent : "50%",
  left: isVertical ? "50%" : completedPercent,
  zIndex: INDICATOR_Z_INDEX,
  ...getAbsoluteCenteredBoxStyle({
    width: indicatorSizePx,
    height: indicatorSizePx,
  }),
});
