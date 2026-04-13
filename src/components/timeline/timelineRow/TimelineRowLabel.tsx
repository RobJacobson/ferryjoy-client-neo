/**
 * End-aligned direction label (e.g. to/from) with shared side gutter.
 */

import { View } from "@/components/ui";
import { TIMELINE_SHARED_CONFIG } from "../config";
import type { TimelineVisualTheme } from "../theme";
import { TimelineRowText } from "./TimelineRowText";

type TimelineRowLabelProps = {
  label: string;
  theme: TimelineVisualTheme;
};

/**
 * Flex row aligned to the track edge: Victor Mono label and shared margin
 * offset for the marker column.
 *
 * @param label - Short direction string (e.g. to/from)
 * @param theme - Body text color for the label
 * @returns End-aligned label row with side gutter
 */
const TimelineRowLabel = ({ label, theme }: TimelineRowLabelProps) => (
  <View
    className="flex-row justify-end pr-2"
    style={{
      marginRight: TIMELINE_SHARED_CONFIG.sideColumnOffsetPx,
    }}
  >
    <TimelineRowText theme={theme}>{label}</TimelineRowText>
  </View>
);

export { TimelineRowLabel };
