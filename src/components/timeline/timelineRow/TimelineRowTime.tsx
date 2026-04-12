/**
 * One time line: Lucide glyph (kind-specific) plus spaced 12h text or `--`.
 */

import { CalendarClock, EqualApproximately, Timer } from "lucide-react-native";
import { View } from "@/components/ui";
import { TIMELINE_ROW_CONFIG } from "../config";
import type { TimelineVisualTheme } from "../theme";
import { TimelineRowSpacedTime } from "./TimelineRowSpacedTime";
import { TimelineRowText } from "./TimelineRowText";

/** Icon and icon–text gap differ slightly per kind for visual balance. */
const eventIcons = {
  scheduled: { Icon: CalendarClock, gapPx: 4 },
  actual: { Icon: Timer, gapPx: 1 },
  estimated: { Icon: EqualApproximately, gapPx: 1 },
} as const;

type TimelineTimeIconKind = keyof typeof eventIcons;

type TimelineRowTimeProps = {
  kind: TimelineTimeIconKind;
  at: Date | undefined;
  theme: TimelineVisualTheme;
};

/**
 * Renders one icon beside the time: spaced clock + AM/PM, or a placeholder.
 *
 * @param kind - Which time row (selects Lucide glyph and icon–text gap)
 * @param at - Instant to show, or undefined for `--`
 * @param theme - Body text and icon colors
 * @returns A single time row view
 */
const TimelineRowTime = ({ kind, at, theme }: TimelineRowTimeProps) => {
  const { Icon, gapPx } = eventIcons[kind];

  return (
    <View className="mt-[-1px] flex-row items-center" style={{ gap: gapPx }}>
      <Icon
        className="translate-y-[-1px]"
        color={theme.text.iconColor}
        size={TIMELINE_ROW_CONFIG.times.iconSizePx}
        strokeWidth={1.25}
      />
      {at ? (
        <TimelineRowSpacedTime at={at} theme={theme} />
      ) : (
        <TimelineRowText theme={theme}>--</TimelineRowText>
      )}
    </View>
  );
};

export type { TimelineTimeIconKind };
export { TimelineRowTime };
