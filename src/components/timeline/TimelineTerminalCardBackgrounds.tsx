/**
 * Blurred terminal highlight regions behind "at terminal" timeline spans.
 *
 * Drawn before the track so the spine and markers read on top. Geometry is
 * produced by the feature pipeline (`TerminalCardGeometry`).
 */

import type { ComponentRef, RefObject } from "react";
import type { View as RNView } from "react-native";
import { BlurView } from "@/components/BlurView";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "./theme";
import type { TerminalCardGeometry } from "./types";

type TimelineTerminalCardBackgroundsProps = {
  cards: TerminalCardGeometry[];
  blurTargetRef: RefObject<ComponentRef<typeof RNView> | null>;
  theme: TimelineVisualTheme;
};

const terminalCardPositionClasses: Record<
  TerminalCardGeometry["position"],
  string
> = {
  top: "rounded-t-[28px] border-x border-t border-b-0",
  bottom: "rounded-b-[28px] border-x border-b border-t-0",
  single: "rounded-[28px] border",
};

/**
 * Renders one blurred card per pre-computed geometry entry.
 *
 * @param cards - Terminal regions and corner treatment from the pipeline
 * @param blurTargetRef - Host view used as the blur sampling target
 * @param theme - Card blur tint, fill, and border from the visual theme
 * @returns Absolutely positioned layer of terminal backgrounds
 */
export const TimelineTerminalCardBackgrounds = ({
  cards,
  blurTargetRef,
  theme,
}: TimelineTerminalCardBackgroundsProps) => (
  <View className="absolute inset-0" pointerEvents="none">
    {cards.map((card) => (
      <BlurView
        key={card.id}
        blurTarget={blurTargetRef}
        intensity={TIMELINE_RENDER_CONSTANTS.cards.blurIntensity}
        tint={theme.cards.blurTint}
        blurMethod="dimezisBlurView"
        className="absolute"
        style={{
          top: card.topPx,
          height: card.heightPx,
          left: 0,
          right: 0,
          borderRadius: card.position === "single" ? 28 : undefined,
          borderTopLeftRadius: card.position !== "bottom" ? 28 : undefined,
          borderTopRightRadius: card.position !== "bottom" ? 28 : undefined,
          borderBottomLeftRadius: card.position !== "top" ? 28 : undefined,
          borderBottomRightRadius: card.position !== "top" ? 28 : undefined,
        }}
      >
        <View
          className={cn(
            "absolute inset-0 border-white/80",
            terminalCardPositionClasses[card.position]
          )}
          style={{
            backgroundColor: theme.cards.fillColor,
            borderWidth: theme.cards.borderWidth,
          }}
        />
      </BlurView>
    ))}
  </View>
);
