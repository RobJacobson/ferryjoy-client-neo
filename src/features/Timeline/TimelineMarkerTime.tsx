/**
 * Displays a formatted time string with an icon indicating the type of time (actual, estimated, or scheduled).
 * Renders the time text and icon in a horizontal row with centered alignment.
 */

import { CalendarClock, EqualApproximately, Watch } from "lucide-react-native";
import { Text, View } from "react-native";
import { toDisplayTime } from "@/shared/utils/dateConversions";

export type TimelineTimeType = "actual" | "estimated" | "scheduled";

export type TimelineMarkerTimeProps = {
  /**
   * Date object containing the time to display.
   */
  time?: Date;
  /**
   * The type of time being displayed, which determines the icon.
   */
  type?: TimelineTimeType;
  /**
   * Boolean to apply bold styling to the time text.
   */
  bold?: boolean;
};

/**
 * Displays a formatted time string with an icon indicating the type of time (actual, estimated, or scheduled).
 * Renders the time text and icon in a horizontal row with centered alignment.
 *
 * @param time - Optional Date object containing the time to display
 * @param type - The type of time being displayed ("actual", "estimated", or "scheduled")
 * @param bold - Optional boolean to apply bold styling to the time text (default false)
 * @returns A View component with the time and icon in a row, or null if time is not provided
 */
const TimelineMarkerTime = ({ time, type, bold }: TimelineMarkerTimeProps) => {
  if (!time) return null;

  const Icon =
    type === "actual"
      ? Watch
      : type === "estimated"
        ? EqualApproximately
        : type === "scheduled"
          ? CalendarClock
          : null;

  return (
    <View
      className="flex-row items-center justify-center"
      style={{ gap: type === "scheduled" ? 2 : 1 }}
    >
      {Icon && (
        <Icon size={12} strokeWidth={1.5} color={bold ? "#000" : "#333"} />
      )}
      <Text
        className={`text-[10px] ${bold ? "font-playwrite" : "font-playwrite-extralight"}`}
      >
        {toDisplayTime(time)}
      </Text>
    </View>
  );
};

export default TimelineMarkerTime;
