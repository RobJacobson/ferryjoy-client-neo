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
   * When true, applies bold styling (e.g. for the first/primary time row).
   */
  isBold?: boolean;
};

/**
 * Displays a formatted time string with an icon indicating the type of time (actual, estimated, or scheduled).
 * Renders the time text and icon in a horizontal row with centered alignment.
 *
 * @param time - Optional Date object containing the time to display
 * @param type - The type of time being displayed ("actual", "estimated", or "scheduled")
 * @param isBold - Optional; when true applies bold styling (default false)
 * @returns A View component with the time and icon in a row, or null if time is not provided
 */
const TimelineMarkerTime = ({
  time,
  type,
  isBold = false,
}: TimelineMarkerTimeProps) => {
  if (!time)
    return (
      <View>
        <Text> </Text>
      </View>
    );

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
        <Icon size={12} strokeWidth={1.5} color={isBold ? "#000" : "#333"} />
      )}
      <Text
        className={`text-[10px] ${isBold ? "font-playwrite" : "font-playwrite-extralight"}`}
      >
        {toDisplayTime(time)}
      </Text>
    </View>
  );
};

export default TimelineMarkerTime;
