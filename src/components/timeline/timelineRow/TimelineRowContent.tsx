/**
 * One timeline row: terminal headline, label/times columns, and center marker.
 */

import { View } from "@/components/ui";
import {
  TIMELINE_SIDE_COLUMN_OFFSET_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderEvent, TimelineRenderRow } from "../types";
import { TimelineRowEventLabel } from "./TimelineRowEventLabel";
import { TimelineRowEventTimes } from "./TimelineRowEventTimes";
import { TimelineRowMarker } from "./TimelineRowMarker";
import { TimelineRowTerminalName } from "./TimelineRowTerminalName";

type TimelineRowContentProps = {
  row: TimelineRenderRow;
  theme: TimelineVisualTheme;
};

const TIMELINE_ROW_CONTENT_NUDGE_PX = 2;

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

type TimelineRowBodyProps = {
  label: string;
  point: TimelineRenderEvent["timePoint"];
  showPlaceholder: boolean;
  theme: TimelineVisualTheme;
};

/**
 * Left label column and right times column, straddling the track marker.
 *
 * @param label - Short arrive/depart line from `getStartEventDisplay`
 * @param point - Scheduled / actual / estimated times for the start event
 * @param showPlaceholder - When true, may show a time placeholder
 * @param theme - Label and time styling
 * @returns Horizontal flex row with gutter offsets for the marker column
 */
const TimelineRowBody = ({
  label,
  point,
  showPlaceholder,
  theme,
}: TimelineRowBodyProps) => (
  <View className="mt-[-13px] h-full flex-row">
    <View
      style={{
        width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
      }}
    >
      <View
        className="flex-row justify-end"
        style={{
          marginRight:
            TIMELINE_SIDE_COLUMN_OFFSET_PX + TIMELINE_ROW_CONTENT_NUDGE_PX,
        }}
      >
        <TimelineRowEventLabel label={label} theme={theme} />
      </View>
    </View>
    <View
      className="flex-1"
      style={{
        marginLeft:
          TIMELINE_SIDE_COLUMN_OFFSET_PX + TIMELINE_ROW_CONTENT_NUDGE_PX,
      }}
    >
      <TimelineRowEventTimes
        point={point}
        showPlaceholder={showPlaceholder}
        theme={theme}
      />
    </View>
  </View>
);

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
