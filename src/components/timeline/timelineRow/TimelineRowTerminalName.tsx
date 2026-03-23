/**
 * Stylized terminal name heading for dock rows (above the card region).
 */

import { StrokeText } from "@/components/StrokeText";
import { View } from "@/components/ui";
import { TIMELINE_ROW_CONFIG } from "../config";
import type { TimelineVisualTheme } from "../theme";

type TimelineRowTerminalNameProps = {
  text: string;
  theme: TimelineVisualTheme;
};

/**
 * Absolutely positioned, rotated display name using puffberry typography.
 *
 * @param text - Full terminal display name
 * @param theme - Terminal heading color from the visual theme
 * @returns Non-interactive overlay text
 */
export const TimelineRowTerminalName = ({
  text,
  theme,
}: TimelineRowTerminalNameProps) => (
  <View
    className="absolute -top-10 -left-3"
    style={{
      zIndex: TIMELINE_ROW_CONFIG.terminalName.zIndex,
      elevation: TIMELINE_ROW_CONFIG.terminalName.elevation,
      transform: [
        { rotate: `${TIMELINE_ROW_CONFIG.terminalName.rotationDeg}deg` },
      ],
    }}
    pointerEvents="none"
  >
    <StrokeText
      outlineColor={theme.outlines.color}
      outlineWidth={TIMELINE_ROW_CONFIG.terminalName.outlineWidthPx}
      style={{
        color: theme.text.terminalNameColor,
        fontFamily: "Puffberry",
        fontSize: TIMELINE_ROW_CONFIG.terminalName.fontSizePx,
      }}
    >
      {text}
    </StrokeText>
  </View>
);
