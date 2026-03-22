/**
 * Left-column event label for timeline rows.
 */

import { Text, View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import { TimelineOutlinedText } from "./TimelineOutlinedText";

type TimelineRowEventLabelProps = {
  label: string;
  theme: TimelineVisualTheme;
};

/**
 * Renders the short event label text for a timeline row event.
 *
 * @param event - The event containing event and terminal data
 * @returns The label view for the event
 */
export const TimelineRowEventLabel = ({
  label,
  theme,
}: TimelineRowEventLabelProps) => (
  <View className="relative">
    <TimelineOutlinedText>
      <Text
        className="font-bitcount-500 text-lg"
        style={{ color: theme.labels.eventLabelColor }}
      >
        {label}
      </Text>
    </TimelineOutlinedText>
  </View>
);
