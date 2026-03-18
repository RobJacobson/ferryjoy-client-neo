/**
 * Shared terminal card backgrounds for "at terminal" portions of a timeline.
 *
 * Renders pre-computed rectangular regions with rounded corners. Must be
 * rendered before the timeline track so cards appear below it.
 */

import type { ComponentRef, RefObject } from "react";
import type { View as RNView } from "react-native";
import { BlurView } from "@/components/BlurView";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TerminalCardGeometry } from "./types";

type TimelineTerminalCardBackgroundsProps = {
  cards: TerminalCardGeometry[];
  blurTargetRef: RefObject<ComponentRef<typeof RNView> | null>;
};

const terminalCardPositionClasses: Record<
  TerminalCardGeometry["position"],
  string
> = {
  top: "rounded-t-[28px] border-x border-t",
  bottom: "rounded-b-[28px] border-x border-b",
  single: "rounded-[28px] border",
};

/**
 * Renders terminal card backgrounds from pre-computed geometry.
 *
 * @param props - Cards array from pipeline
 * @returns Absolute-positioned container with card views
 */
export const TimelineTerminalCardBackgrounds = ({
  cards,
  blurTargetRef,
}: TimelineTerminalCardBackgroundsProps) => (
  <View className="absolute inset-0" pointerEvents="none">
    {cards.map((card) => (
      <BlurView
        key={card.id}
        blurTarget={blurTargetRef}
        intensity={30}
        tint="light"
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
            "absolute inset-0 border-white bg-white/30",
            terminalCardPositionClasses[card.position]
          )}
        />
      </BlurView>
    ))}
  </View>
);
