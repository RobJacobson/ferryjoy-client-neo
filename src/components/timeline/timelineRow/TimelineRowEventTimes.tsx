/**
 * Right column: one or more time rows (scheduled plus actual or estimated).
 *
 * Each row stacks a stroked icon silhouette with the tinted icon and outlined
 * time text for legibility on busy backgrounds.
 */

import {
  CalendarClock,
  EqualApproximately,
  type LucideIcon,
  Timer,
} from "lucide-react-native";
import { StrokeText } from "@/components/StrokeText";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineTimePoint } from "../types";

const EVENT_TIME_ICON_SIZE_PX = 22;
const EVENT_TIME_ICON_STROKE_WIDTH = 2;
const EVENT_TIME_ICON_OUTLINE_WIDTH = 2;
const EVENT_TIME_TEXT_STYLE = {
  fontFamily: "BitcountPropSingle-500",
  fontSize: 18,
} as const;
const eventTypeIcons = {
  actual: Timer,
  scheduled: CalendarClock,
  estimated: EqualApproximately,
} as const;

type TimelineRowEventTimesProps = {
  point: TimelineTimePoint;
  showPlaceholder?: boolean;
  theme: TimelineVisualTheme;
};

type TimelineTimeEntry = {
  Icon: LucideIcon;
  label: string;
  rowClassName?: string;
};

/**
 * Builds icon rows from schedule-first display rules and optional placeholder.
 *
 * @param point - Scheduled, actual, and estimated instants for the event
 * @param showPlaceholder - When true and no times exist, shows a placeholder row
 * @param theme - Icon and text colors for the time rows
 * @returns Horizontal group of time rows
 */
export const TimelineRowEventTimes = ({
  point,
  showPlaceholder = false,
  theme,
}: TimelineRowEventTimesProps) => {
  const { scheduled, actual, estimated } = point;
  const secondary = actual ?? estimated;
  const timeEntries = getTimeEntries({
    scheduled,
    secondary,
    secondaryIcon: eventTypeIcons[actual ? "actual" : "estimated"],
    showPlaceholder,
  });

  return (
    <View className="flex-row gap-1">
      {timeEntries.map(({ Icon, label, rowClassName }) => (
        <TimelineRowEventTime
          key={`${Icon.displayName ?? Icon.name}:${label}`}
          Icon={Icon}
          label={label}
          rowClassName={rowClassName}
          theme={theme}
        />
      ))}
    </View>
  );
};

type TimelineRowEventTimeProps = {
  Icon: LucideIcon;
  label: string;
  rowClassName?: string;
  theme: TimelineVisualTheme;
};

/**
 * One outlined icon beside an outlined time string.
 *
 * @param Icon - Lucide icon for this row's time kind
 * @param label - Formatted time or placeholder text
 * @param rowClassName - Optional flex gap between icon and label
 * @param theme - Icon tint and text color
 * @returns A single time row view
 */
const TimelineRowEventTime = ({
  Icon,
  label,
  rowClassName,
  theme,
}: TimelineRowEventTimeProps) => (
  <View className={cn("flex-row", rowClassName)}>
    <TimelineOutlinedIcon
      Icon={Icon}
      color={theme.times.iconColor}
      outlineColor={theme.outlines.color}
    />
    <StrokeText
      outlineColor={theme.outlines.color}
      style={[EVENT_TIME_TEXT_STYLE, { color: theme.times.textColor }]}
    >
      {label}
    </StrokeText>
  </View>
);

type TimelineOutlinedIconProps = {
  Icon: LucideIcon;
  color: string;
  outlineColor: string;
};

/**
 * Draws the icon twice to create a simple outline behind the tinted glyph.
 *
 * @param Icon - Lucide icon to render
 * @param color - Foreground icon color
 * @param outlineColor - HSLA outline color behind the icon
 * @returns Outlined icon view
 */
const TimelineOutlinedIcon = ({
  Icon,
  color,
  outlineColor,
}: TimelineOutlinedIconProps) => (
  <View className="relative">
    <View className="absolute top-0 left-0">
      <Icon
        size={EVENT_TIME_ICON_SIZE_PX}
        strokeWidth={
          EVENT_TIME_ICON_STROKE_WIDTH + EVENT_TIME_ICON_OUTLINE_WIDTH * 2
        }
        color={outlineColor}
      />
    </View>
    <Icon
      size={EVENT_TIME_ICON_SIZE_PX}
      strokeWidth={EVENT_TIME_ICON_STROKE_WIDTH}
      color={color}
    />
  </View>
);

/**
 * Produces ordered time rows: optional placeholder, scheduled, then secondary.
 *
 * @param scheduled - Baseline scheduled instant, if any
 * @param secondary - Actual if set, else estimated, when present
 * @param secondaryIcon - Icon matching actual vs estimated for the secondary row
 * @param showPlaceholder - Enables `--` placeholder when no times exist
 * @returns Entries rendered as `TimelineRowEventTime` rows
 */
const getTimeEntries = ({
  scheduled,
  secondary,
  secondaryIcon,
  showPlaceholder,
}: {
  scheduled?: Date;
  secondary?: Date;
  secondaryIcon: LucideIcon;
  showPlaceholder: boolean;
}): TimelineTimeEntry[] => {
  const entries: TimelineTimeEntry[] = [];

  if (!scheduled && !secondary && showPlaceholder) {
    entries.push({
      Icon: CalendarClock,
      label: "--",
      rowClassName: "gap-2",
    });
  }

  if (scheduled) {
    entries.push({
      Icon: eventTypeIcons.scheduled,
      label: toDisplayTime(scheduled),
      rowClassName: "gap-0.5",
    });
  }

  if (secondary) {
    entries.push({
      Icon: secondaryIcon,
      label: toDisplayTime(secondary),
      rowClassName: "gap-0.5",
    });
  }

  return entries;
};
