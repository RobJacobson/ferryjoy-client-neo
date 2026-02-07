/**
 * TimelineMarkerlLabel renders the marker label line and up to two time rows.
 * Times are passed as data (time + type) so this component can enforce
 * presentation rules consistently (TimeOne always bold, TimeTwo never bold).
 */

import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";
import TimelineMarkerTime, {
  type TimelineMarkerTimeProps,
} from "./TimelineMarkerTime";

type TimelineMarkerlLabelTime = Omit<TimelineMarkerTimeProps, "bold">;

type TimelineMarkerlLabelProps = {
  /**
   * The human-friendly label shown above or beside the time rows.
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
  /**
   * Orientation of the label layout.
   * "vertical" (default) stacks text vertically.
   * "horizontal" places Label | TimeOne | TimeTwo in a single row.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * Text alignment for vertical orientation.
   */
  align?: "left" | "right" | "center";
};

/**
 * Renders a marker label with one or two time rows.
 *
 * @param LabelText - The label string to display
 * @param TimeOne - Optional first time element (usually bold primary time)
 * @param TimeTwo - Optional second time element (usually scheduled time)
 * @param orientation - Layout orientation ("vertical" or "horizontal")
 * @param align - Text alignment for vertical layout
 * @returns A label block for `TimelineMarker`
 */
const TimelineMarkerlLabel = ({
  LabelText,
  TimeOne,
  TimeTwo,
  orientation = "vertical",
  align = "center",
}: TimelineMarkerlLabelProps) => {
  if (orientation === "horizontal") {
    return (
      <View className="flex-row items-center" style={{ gap: 4 }}>
        <Text className="text-xs text-muted-foreground font-playwrite-bold">
          {LabelText}
        </Text>
        <View className="w-[1px] h-3 bg-muted-foreground/30 mx-1" />
        {TimeOne ? <TimelineMarkerTime {...TimeOne} bold /> : null}
        {TimeTwo ? (
          <>
            <Text className="text-[10px] text-muted-foreground">/</Text>
            <TimelineMarkerTime {...TimeTwo} bold={false} />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className={cn(
        "items-center",
        align === "left" ? "items-start" : align === "right" ? "items-end" : ""
      )}
    >
      <Text className="text-xs text-muted-foreground">{LabelText}</Text>
      {TimeOne ? <TimelineMarkerTime {...TimeOne} bold /> : null}
      {TimeTwo ? <TimelineMarkerTime {...TimeTwo} bold={false} /> : null}
    </View>
  );
};

export default TimelineMarkerlLabel;
