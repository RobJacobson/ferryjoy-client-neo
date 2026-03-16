/**
 * Shared terminal card backgrounds for "at terminal" portions of a timeline.
 *
 * Renders pre-computed rectangular regions with rounded corners. Must be
 * rendered before the timeline track so cards appear below it.
 */

import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TerminalCardGeometry } from "./types";

type TimelineTerminalCardBackgroundsProps = {
  cards: TerminalCardGeometry[];
};

/**
 * Renders terminal card backgrounds from pre-computed geometry.
 *
 * @param props - Cards array from pipeline
 * @returns Absolute-positioned container with card views
 */
export const TimelineTerminalCardBackgrounds = ({
  cards,
}: TimelineTerminalCardBackgroundsProps) => (
  <View className="absolute inset-0" pointerEvents="none">
    {cards.map((card) => (
      <View
        key={card.id}
        className={cn(
          "absolute right-0 left-0 border-white bg-white/50",
          card.position === "top" && "rounded-t-[28px] border-x border-t",
          card.position === "bottom" && "rounded-b-[28px] border-x border-b",
          card.position === "single" && "rounded-[28px] border"
        )}
        style={{
          top: card.topPx,
          height: card.heightPx,
        }}
      />
    ))}
  </View>
);
