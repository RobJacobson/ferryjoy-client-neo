/**
 * Stylized terminal name heading for dock rows (above the card region).
 */

import { Text, View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import { TimelineOutlinedText } from "./TimelineOutlinedText";

type TimelineRowTerminalNameProps = {
  text: string;
  theme: TimelineVisualTheme;
};

/**
 * Absolutely positioned, rotated display name using puffberry typography.
 *
 * @param text - Full terminal display name
 * @param theme - Terminal name color from the visual theme
 * @returns Non-interactive overlay text
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
    <TimelineOutlinedText outlineColor={theme.outlines.color} outlineWidth={2}>
      <Text
        className="font-puffberry text-3xl"
        style={{ color: theme.labels.terminalNameColor }}
      >
        {text}
      </Text>
    </TimelineOutlinedText>
  </View>
);
