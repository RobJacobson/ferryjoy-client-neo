import { Text, View } from "@/components/ui";
import {
  DEFAULT_TIMELINE_VISUAL_THEME,
  type TimelineVisualTheme,
} from "../theme";
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
  theme = DEFAULT_TIMELINE_VISUAL_THEME,
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
        transform: [{ rotate: `${theme.labels.terminalNameRotationDeg}deg` }],
      }}
      pointerEvents="none"
    >
      <TimelineOutlinedText
        outlineClassName=""
        outlineStyle={{ color: theme.labels.terminalNameShadowColor }}
        outlineWidth={2}
      >
        <Text
          className={theme.labels.terminalNameFontClassName}
          style={[
            { color: theme.labels.terminalNameColor },
            theme.labels.terminalNameStyle,
          ]}
        >
          {terminalDisplayName}
        </Text>
      </TimelineOutlinedText>
    </View>
  );
};
