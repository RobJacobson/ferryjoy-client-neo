/**
 * Displays a formatted time string with an optional suffix and bold styling.
 * Renders the time text and suffix in a horizontal row with centered alignment.
 */

import { View } from "react-native";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import TimelineLegendText from "./TimelineLegendText";

type TimelineDisplayTimeProps = {
  /**
   * Date object containing the time to display.
   */
  time?: Date;
  /**
   * String suffix to display after the time (e.g., "ETD", "ETA", "Sched").
   */
  suffix?: string;
  /**
   * Boolean to apply bold styling to the time text.
   */
  bold?: boolean;
};

/**
 * Displays a formatted time string with an optional suffix and bold styling.
 * Renders the time text and suffix in a horizontal row with centered alignment.
 *
 * @param time - Optional Date object containing the time to display
 * @param suffix - Optional string suffix to display after the time (e.g., "ETD", "ETA", "Sched")
 * @param bold - Optional boolean to apply bold styling to the time text (default false)
 * @returns A View component with the time and suffix in a row, or null if text is not provided
 */
const TimelineDisplayTime = ({
  time,
  suffix,
  bold,
}: TimelineDisplayTimeProps) =>
  time && (
    <View className="flex-row items-center justify-center">
      <TimelineLegendText bold={bold}>{toDisplayTime(time)}</TimelineLegendText>
      {suffix && (
        <TimelineLegendText bold={false}>{` ${suffix}`}</TimelineLegendText>
      )}
    </View>
  );

export default TimelineDisplayTime;
