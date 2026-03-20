import { Text, View } from "@/components/ui";
import { BASE_TIMELINE_VISUAL_THEME, type TimelineVisualTheme } from "../theme";
import type { TimelineRenderEvent } from "../types";
import { TimelineOutlinedText } from "./TimelineOutlinedText";

type TimelineRowTerminalHeadlineProps = {
  event: TimelineRenderEvent;
  theme?: TimelineVisualTheme;
};

/**
 * Renders the terminal headline that visually sits above an at-terminal card.
 */
export const TimelineRowTerminalHeadline = ({
  event,
  theme = BASE_TIMELINE_VISUAL_THEME,
}: TimelineRowTerminalHeadlineProps) => {
  const terminalDisplayName = event.currTerminalDisplayName;

  if (!terminalDisplayName || event.eventType !== "arrive") {
    return null;
  }

  return (
    <View
      className="absolute -top-10 -left-3"
      style={{
        zIndex: 2,
        elevation: 2,
        transform: [{ rotate: "-9deg" }],
      }}
      pointerEvents="none"
    >
      <TimelineOutlinedText outlineClassName="" outlineWidth={2}>
        <Text
          className="font-puffberry text-3xl"
          style={{ color: theme.labels.terminalNameColor }}
        >
          {terminalDisplayName}
        </Text>
      </TimelineOutlinedText>
    </View>
  );
};
