/**
 * One timeline row: terminal headline, label/times columns, and center marker.
 */

import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderEvent, TimelineRenderRow } from "../types";
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
  const startEventDisplay = getStartEventDisplay(row.startEvent);
  const terminalHeadline = getTerminalHeadline(row.startEvent);

  return (
    <View className="relative h-full w-full">
      {terminalHeadline && (
        <TimelineRowTerminalName text={terminalHeadline} theme={theme} />
      )}
      <TimelineRowBody
        label={startEventDisplay.label}
        point={row.startEvent.timePoint}
        showPlaceholder={startEventDisplay.showTimePlaceholder}
        theme={theme}
      />
      <TimelineRowMarker row={row} theme={theme} />
    </View>
  );
};

/**
 * Derives the left-column label and placeholder behavior for the start event.
 *
 * @param event - Start-of-row render event
 * @returns Label string and whether to show a time placeholder
 */
const getStartEventDisplay = (event: TimelineRenderEvent) => ({
  label:
    event.eventType === "arrive"
      ? event.currTerminalAbbrev
        ? `Arv: ${event.currTerminalAbbrev}`
        : "Arv"
      : event.nextTerminalAbbrev
        ? `To: ${event.nextTerminalAbbrev}`
        : "Dep",
  showTimePlaceholder: event.isArrivalPlaceholder === true,
});

/**
 * Optional display name shown above dock rows for the current terminal.
 *
 * @param event - Start-of-row render event
 * @returns Terminal display name for arrivals, else undefined
 */
const getTerminalHeadline = (event: TimelineRenderEvent) =>
  event.eventType === "arrive" ? event.currTerminalDisplayName : undefined;
