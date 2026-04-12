/**
 * 12h clock and AM/PM as sibling `Text` nodes so Victor Mono tracks cleanly.
 */

import { Text, View } from "@/components/ui";
import type { TimelineVisualTheme } from "../theme";
import { TimelineRowText } from "./TimelineRowText";

type TimelineRowSpacedTimeProps = {
  at: Date;
  theme: TimelineVisualTheme;
};

type EnUs12hFields = {
  hour?: string;
  minute?: string;
  dayPeriod?: string;
};

/**
 * Parses `en-US` 12-hour parts from a `Date` (same shape as row `toDisplayTime`).
 *
 * @param at - Wall-clock instant
 * @returns `HH:MM` string and `AM` / `PM`
 */
const splitEnUs12h = (at: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(at);

  const fields = Object.fromEntries(
    parts.map((p) => [p.type, p.value])
  ) as EnUs12hFields;
  const { hour = "", minute = "", dayPeriod: period = "" } = fields;

  return { clock: `${hour}:${minute}`, period };
};

/**
 * Renders a time as clock + period with a fractional gap between them.
 *
 * @param at - Wall-clock instant (`Date`)
 * @param theme - Body text color
 * @returns Row with two text children
 */
const TimelineRowSpacedTime = ({ at, theme }: TimelineRowSpacedTimeProps) => {
  const { clock, period } = splitEnUs12h(at);

  return (
    <View className="flex-row items-baseline gap-1">
      <TimelineRowText theme={theme}>{clock}</TimelineRowText>
      <TimelineRowText theme={theme}>{period}</TimelineRowText>
    </View>
  );
};

export { TimelineRowSpacedTime };
