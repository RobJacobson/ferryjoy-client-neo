/**
 * TimelineMarkerlLabel renders the marker label line and up to two time rows.
 * Times are passed as data (time + type) so this component can enforce
 * presentation rules consistently (TimeOne always bold, TimeTwo never bold).
 */

import { View } from "react-native";
import { Text } from "@/components/ui";
import TimelineMarkerTime, {
  type TimelineMarkerTimeProps,
} from "./TimelineMarkerTime";

type TimelineMarkerlLabelTime = Omit<TimelineMarkerTimeProps, "bold">;

type TimelineMarkerlLabelProps = {
  /**
   * The human-friendly label shown above the time rows (e.g. "Arrived SEA").
   */
  LabelText: string;
  /**
   * Optional first time row (typically the "primary" time).
   */
  TimeOne?: TimelineMarkerlLabelTime | null;
  /**
   * Optional second time row (typically a secondary or scheduled time).
   */
  TimeTwo?: TimelineMarkerlLabelTime | null;
};

/**
 * Renders a marker label with one or two time rows beneath it.
 *
 * @param LabelText - The label string to display
 * @param TimeOne - Optional first time element (usually bold primary time)
 * @param TimeTwo - Optional second time element (usually scheduled time)
 * @returns A vertically-stacked label block for `TimelineMarker`
 */
const TimelineMarkerlLabel = ({
  LabelText,
  TimeOne,
  TimeTwo,
}: TimelineMarkerlLabelProps) => {
  return (
    <View className="items-center">
      <Text className="text-xs text-muted-foreground">{LabelText}</Text>
      {TimeOne ? <TimelineMarkerTime {...TimeOne} bold /> : null}
      {TimeTwo ? <TimelineMarkerTime {...TimeTwo} bold={false} /> : null}
    </View>
  );
};

export default TimelineMarkerlLabel;
