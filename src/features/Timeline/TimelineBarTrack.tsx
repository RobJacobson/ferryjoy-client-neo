/**
 * Track + fill rendering for `TimelineBar`.
 * Kept separate to isolate pure visual concerns from time/progress logic.
 */

import { View } from "react-native";
import { cn } from "@/lib/utils";
import { shadowStyle } from "./config";

export type TimelineBarTrackProps = {
  /**
   * Progress value between 0 and 1.
   */
  progress: number;
  /**
   * Height of the bar in pixels.
   */
  barHeight: number;
  /**
   * Optional className applied to the track container (unfilled portion).
   */
  trackClassName?: string;
  /**
   * Optional className applied to the filled portion.
   */
  fillClassName?: string;
};

/**
 * Renders the track + filled segment for the progress bar.
 *
 * @param progress - Value between 0 and 1
 * @param barHeight - Height of the bar in pixels
 * @param trackClassName - Optional theme className for the track
 * @param fillClassName - Optional theme className for the fill
 * @returns Track + fill view
 */
export const TimelineBarTrack = ({
  progress,
  barHeight,
  trackClassName,
  fillClassName,
}: TimelineBarTrackProps) => (
  <View
    className={cn(
      "flex-1 rounded-full items-start bg-primary/20",
      trackClassName
    )}
    style={{ height: barHeight }}
  >
    <View
      className={cn("rounded-full h-full bg-pink-300", fillClassName)}
      style={{ width: `${progress * 100}%`, ...shadowStyle }}
    />
  </View>
);
