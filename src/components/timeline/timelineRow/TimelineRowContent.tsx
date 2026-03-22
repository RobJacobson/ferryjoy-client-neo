/**
 * Shared row content for the vertical timeline renderer.
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

export const TimelineRowContent = ({ row, theme }: TimelineRowContentProps) => {
  const startEventDisplay = getStartEventDisplay(row.startEvent);
  const terminalHeadline = getTerminalHeadline(row.startEvent);

  return (
    <View className="relative h-full w-full">
      {terminalHeadline && (
        <TimelineRowTerminalName text={terminalHeadline} theme={theme} />
      )}
      <View className="mt-[-13px] h-full flex-row">
        <View
          style={{
            width: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
          }}
        >
          <View
            className="flex-row justify-end"
            style={{ marginRight: TIMELINE_SIDE_COLUMN_OFFSET_PX + 2 }}
          >
            <TimelineRowEventLabel
              label={startEventDisplay.label}
              theme={theme}
            />
          </View>
        </View>
        <View
          className="flex-1"
          style={{ marginLeft: TIMELINE_SIDE_COLUMN_OFFSET_PX + 2 }}
        >
          <TimelineRowEventTimes
            point={row.startEvent.timePoint}
            showPlaceholder={startEventDisplay.showTimePlaceholder}
            theme={theme}
          />
        </View>
      </View>
      <TimelineRowMarker row={row} theme={theme} />
    </View>
  );
};

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

const getTerminalHeadline = (event: TimelineRenderEvent) =>
  event.eventType === "arrive" ? event.currTerminalDisplayName : undefined;
