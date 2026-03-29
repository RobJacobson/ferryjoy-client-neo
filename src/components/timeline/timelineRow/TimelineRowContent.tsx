/**
 * One timeline row: terminal headline, label/times columns, and center marker.
 */

import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderRow } from "../types";
import { TimelineRowBody } from "./TimelineRowBody";
import { TimelineRowMarker } from "./TimelineRowMarker";
import { TimelineRowTerminalName } from "./TimelineRowTerminalName";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  theme: TimelineVisualTheme;
};

/**
 * Renders pipeline row data around the shared vertical track column.
 *
 * @param row - Render row with events, marker state, and segment kind
 * @param theme - Label, time, and marker colors
 * @returns Row interior positioned relative to the track
 */
export const TimelineRowContent = ({ row, theme }: TimelineRowContentProps) => {
  return (
    <View className="relative h-full w-full">
      {row.terminalHeadline && (
        <TimelineRowTerminalName text={row.terminalHeadline} theme={theme} />
      )}
      <TimelineRowBody
        label={row.startLabel}
        point={row.startEvent.timePoint}
        showPlaceholder={row.showStartTimePlaceholder}
        theme={theme}
      />
      <TimelineRowMarker row={row} theme={theme} />
    </View>
  );
};
