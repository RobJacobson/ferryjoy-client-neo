/**
 * One timeline row interior: terminal headline plus label/marker/times body.
 */

import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderRow } from "../types";
import { TimelineRowBody } from "./TimelineRowBody";
import { TimelineRowHeading } from "./TimelineRowHeading";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  theme: TimelineVisualTheme;
};

/**
 * Places heading and body inside the row shell (`TimelineRowFlex` or fixed height).
 *
 * @param row - Render row with events, marker state, and segment kind
 * @param theme - Label, time, and marker colors
 * @returns Row interior positioned relative to the track
 */
const TimelineRowContent = ({ row, theme }: TimelineRowContentProps) => (
  <View className="relative h-full w-full">
    <TimelineRowHeading text={row.terminalHeadline} theme={theme} />
    <TimelineRowBody row={row} theme={theme} />
  </View>
);

export { TimelineRowContent };
