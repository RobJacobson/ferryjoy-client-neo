/**
 * Displays a formatted time string with an icon indicating the type of time (actual, estimated, or scheduled).
 * Renders the time text and icon in a horizontal row with centered alignment.
 */

import { CalendarClock, EqualApproximately, Watch } from "lucide-react-native";
import { Text, View } from "react-native";
import { cn } from "@/lib/utils";
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
  /**
   * Optional className for additional styling on the text container.
   * Merged with default flex-row layout.
   */
  className?: string;
};

/**
 * Displays a formatted time string with an icon indicating the type of time (actual, estimated, or scheduled).
 * Renders the time text and icon in a horizontal row with centered alignment.
 *
 * @param time - Optional Date object containing the time to display
 * @param type - The type of time being displayed ("actual", "estimated", or "scheduled")
 * @param isBold - Optional; when true applies bold styling (default false)
 * @param className - Optional className for additional styling on the container
 * @returns A View component with the time and icon in a row, or null if time is not provided
 */
const TimelineMarkerTime = ({
  time,
  type,
  isBold = false,
  className,
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
      className={cn("flex-row items-center justify-center", className)}
      style={{ gap: type === "actual" ? 3 : 2 }}
    >
      {Icon && <Icon size={14} strokeWidth={1.5} color="#333" />}
      <Text
        className={cn(
          `text-sm ${isBold ? "font-playpen-600" : "font-playpen-300"}`,
          className
        )}
      >
        {toDisplayTime(time)}
      </Text>
    </View>
  );
};

export default TimelineMarkerTime;
