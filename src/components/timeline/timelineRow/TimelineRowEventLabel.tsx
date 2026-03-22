/**
 * Left column: short arrive/depart label with outline treatment.
 */

import { StrokeText } from "@/components/StrokeText";
import { View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";

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
    <StrokeText
      outlineColor={theme.outlines.color}
      style={{
        color: theme.labels.eventLabelColor,
        fontFamily: "BitcountPropSingle-500",
        fontSize: 18,
      }}
    >
      {label}
    </StrokeText>
  </View>
);
