/**
 * Left-column event label for timeline rows.
 */

import { Text, View } from "@/components/ui";
import { TIMELINE_SIDE_COLUMN_OFFSET_PX } from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineRenderEvent } from "../types";
import { TimelineOutlinedText } from "./TimelineOutlinedText";

type TimelineRowEventLabelProps = {
  event: TimelineRenderEvent;
  theme: TimelineVisualTheme;
};

/**
 * Renders the short event label text for a timeline row event.
 *
 * @param event - The event containing event and terminal data
 * @returns The label view for the event
 */
export const TimelineRowEventLabel = ({
  event,
  theme,
}: TimelineRowEventLabelProps) => {
  const labelText =
    event.eventType === "arrive"
      ? event.currTerminalAbbrev
        ? `Arv: ${event.currTerminalAbbrev}`
        : "Arv"
      : event.nextTerminalAbbrev
        ? `To: ${event.nextTerminalAbbrev}`
        : "Dep";

  return (
    <View
      className="relative mx-2 mt-[-8px] flex-1 flex-row"
      style={{ marginRight: TIMELINE_SIDE_COLUMN_OFFSET_PX }}
    >
      <View className="flex-1 flex-row justify-end">
        <TimelineOutlinedText outlineClassName="" outlineWidth={2}>
          <Text
            className="mt-[-6px] py-[2px] font-led-board text-lg"
            style={{ color: theme.labels.eventLabelColor }}
          >
            {labelText}
          </Text>
        </TimelineOutlinedText>
      </View>
    </View>
  );
};
