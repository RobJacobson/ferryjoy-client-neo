/**
 * Blurred terminal highlight regions behind "at terminal" timeline spans.
 *
 * Drawn before the track so the spine and markers read on top. Geometry is
 * produced by the feature pipeline (`TerminalCardGeometry`).
 */

import type { ComponentRef, RefObject } from "react";
import type { View as RNView } from "react-native";
import type { ViewStyle } from "react-native";
import { View } from "@/components/ui";
import { TIMELINE_CARD_CONFIG } from "./config";
import { TimelineGlassSurface } from "./TimelineGlassSurface";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "./theme";
import type { TerminalCardGeometry } from "./types";

type TimelineTerminalCardBackgroundsProps = {
  cards: TerminalCardGeometry[];
  blurTargetRef: RefObject<ComponentRef<typeof RNView> | null>;
  theme: TimelineVisualTheme;
};

const TERMINAL_CARD_CORNER_STYLES: Record<
  TerminalCardGeometry["position"],
  ViewStyle
> = {
  single: {
    borderRadius: TIMELINE_CARD_CONFIG.cornerRadiusPx,
  },
  top: {
    borderTopLeftRadius: TIMELINE_CARD_CONFIG.cornerRadiusPx,
    borderTopRightRadius: TIMELINE_CARD_CONFIG.cornerRadiusPx,
  },
  bottom: {
    borderBottomLeftRadius: TIMELINE_CARD_CONFIG.cornerRadiusPx,
    borderBottomRightRadius: TIMELINE_CARD_CONFIG.cornerRadiusPx,
  },
};

const getTerminalCardBorderStyle = (
  position: TerminalCardGeometry["position"],
  borderWidth: number
): ViewStyle => ({
  borderWidth,
  borderTopWidth: position === "bottom" ? 0 : borderWidth,
  borderBottomWidth: position === "top" ? 0 : borderWidth,
});

/**
 * Renders one blurred card per pre-computed geometry entry.
 *
 * @param cards - Terminal regions and corner treatment from the pipeline
 * @param blurTargetRef - Host view used as the blur sampling target
 * @param theme - Card blur tint, shared glass color, and border from the visual theme
 * @returns Absolutely positioned layer of terminal backgrounds
 */
export const TimelineTerminalCardBackgrounds = ({
  cards,
  blurTargetRef,
  theme,
}: TimelineTerminalCardBackgroundsProps) => (
  <View className="absolute inset-0" pointerEvents="none">
    {cards.map((card) => {
      const cornerStyle = TERMINAL_CARD_CORNER_STYLES[card.position];
      const borderStyle = getTerminalCardBorderStyle(
        card.position,
        theme.cards.borderWidth
      );

      return (
        <TimelineGlassSurface
          key={card.id}
          blurTargetRef={blurTargetRef}
          blurIntensity={TIMELINE_RENDER_CONSTANTS.cards.blurIntensity}
          theme={theme}
          className="absolute"
          style={{
            top: card.topPx,
            height: card.heightPx,
            left: 0,
            right: 0,
            ...cornerStyle,
          }}
        >
          <View
            className="absolute inset-0"
            style={{
              borderColor: theme.glassBorderColor,
              ...cornerStyle,
              ...borderStyle,
            }}
          />
        </TimelineGlassSurface>
      );
    })}
  </View>
);
