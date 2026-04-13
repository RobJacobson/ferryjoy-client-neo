/**
 * Stylized terminal name heading for dock rows (angled above the row body).
 */

import { StrokeText } from "@/components/StrokeText";
import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";

type TimelineRowHeadingProps = {
  text?: string;
  theme: TimelineVisualTheme;
};

/**
 * Absolutely positioned, rotated display name using puffberry typography.
 *
 * @param text - Full terminal display name
 * @param theme - Terminal heading color from the visual theme
 * @returns Non-interactive overlay text
 */
const TimelineRowHeading = ({ text, theme }: TimelineRowHeadingProps) => {
  if (!text) {
    return null;
  }

  return (
    <View
      className="absolute -top-6 -left-2 rotate-[-9deg]"
      style={{
        transformOrigin: "bottom left",
      }}
      pointerEvents="none"
    >
      <StrokeText
        outlineColor="white"
        outlineWidth={2}
        style={{
          color: theme.text.terminalNameColor,
          fontFamily: "Puffberry",
          fontSize: 26,
        }}
      >
        {text}
      </StrokeText>
    </View>
  );
};

export { TimelineRowHeading };
