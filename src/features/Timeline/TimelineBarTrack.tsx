/**
 * Track + fill rendering for `TimelineBar`.
 * Kept separate to isolate pure visual concerns from time/progress logic.
 */

import { View } from "react-native";
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
};

/**
 * Renders the track + filled segment for the progress bar.
 *
 * @param progress - Value between 0 and 1
 * @param barHeight - Height of the bar in pixels
 * @returns Track + fill view
 */
export const TimelineBarTrack = ({
  progress,
  barHeight,
}: TimelineBarTrackProps) => (
  <View
    className="flex-1 rounded-full items-start bg-primary/20"
    style={{ height: barHeight }}
  >
    <View
      className="rounded-full h-full bg-pink-300"
      style={{ width: `${progress * 100}%`, ...shadowStyle }}
    />
  </View>
);
