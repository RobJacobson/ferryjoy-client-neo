import { Text, View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import { TimelineOutlinedText } from "./TimelineOutlinedText";

type TimelineRowTerminalNameProps = {
  text: string;
  theme: TimelineVisualTheme;
};

/**
 * Renders the terminal name that visually sits above an at-terminal card.
 */
export const TimelineRowTerminalName = ({
  text,
  theme,
}: TimelineRowTerminalNameProps) => (
  <View
    className="absolute -top-10 -left-3"
    style={{
      zIndex: 2,
      elevation: 2,
      transform: [{ rotate: "-9deg" }],
    }}
    pointerEvents="none"
  >
    <TimelineOutlinedText outlineWidth={2}>
      <Text
        className="font-puffberry text-3xl"
        style={{ color: theme.labels.terminalNameColor }}
      >
        {text}
      </Text>
    </TimelineOutlinedText>
  </View>
);
