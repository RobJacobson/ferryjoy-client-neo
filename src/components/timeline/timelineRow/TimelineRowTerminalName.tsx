/**
 * Stylized terminal name heading for dock rows (above the card region).
 */

import { StrokeText } from "@/components/StrokeText";
import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";

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
    <StrokeText
      outlineColor={theme.outlines.color}
      outlineWidth={2}
      style={{
        color: theme.labels.terminalNameColor,
        fontFamily: "Puffberry",
        fontSize: 30,
      }}
    >
      {text}
    </StrokeText>
  </View>
);
