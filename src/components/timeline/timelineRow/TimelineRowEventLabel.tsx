/**
 * Left column: short arrive/depart label with outline treatment.
 */

import { Text, View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import { TimelineOutlinedText } from "./TimelineOutlinedText";

type TimelineRowEventLabelProps = {
  label: string;
  theme: TimelineVisualTheme;
};

/**
 * Outlined single-line label using the event label color from the theme.
 *
 * @param label - Preformatted string (e.g. `Arv: XX` or `To: YY`)
 * @param theme - Event label color token
 * @returns Relative wrapper around outlined text
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
