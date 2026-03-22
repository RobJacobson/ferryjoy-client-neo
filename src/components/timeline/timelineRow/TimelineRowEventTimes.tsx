/**
 * Right-column event times with icons for timeline rows.
 */

import {
  CalendarClock,
  EqualApproximately,
  type LucideIcon,
  Timer,
} from "lucide-react-native";
import { Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import type { TimelineVisualTheme } from "../theme";
import type { TimelineTimePoint } from "../types";
import { TimelineOutlinedText } from "./TimelineOutlinedText";

const EVENT_TIME_ICON_SIZE_PX = 22;
const EVENT_TIME_ICON_STROKE_WIDTH = 2;
const EVENT_TIME_ICON_OUTLINE_WIDTH = 2;
const EVENT_TIME_ICON_OUTLINE_COLOR = "rgba(255, 255, 255, 1)";

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
 * Renders scheduled, actual, and estimated times for a timeline event.
 *
 * @param point - The time point containing scheduled, actual, and estimated dates
 * @returns The event times view
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
 * Single time row: outlined icon + outlined time label (shared chrome).
 *
 * @param Icon - Lucide icon for this row
 * @param label - Time string or placeholder text
 * @param rowClassName - Optional row layout classes (e.g. gap between icon and text)
 * @param theme - Timeline colors for icon and text
 * @returns The row view
 */
const TimelineRowEventTime = ({
  Icon,
  label,
  rowClassName,
  theme,
}: TimelineRowEventTimeProps) => (
  <View className={cn("flex-row", rowClassName)}>
    <View className="relative">
      <View className="absolute top-0 left-0">
        <Icon
          size={EVENT_TIME_ICON_SIZE_PX}
          strokeWidth={
            EVENT_TIME_ICON_STROKE_WIDTH + EVENT_TIME_ICON_OUTLINE_WIDTH * 2
          }
          color={EVENT_TIME_ICON_OUTLINE_COLOR}
        />
      </View>
      <Icon
        size={EVENT_TIME_ICON_SIZE_PX}
        strokeWidth={EVENT_TIME_ICON_STROKE_WIDTH}
        color={theme.times.iconColor}
      />
    </View>
    <TimelineOutlinedText>
      <Text
        className="font-bitcount-500 text-lg"
        style={{ color: theme.times.textColor }}
      >
        {label}
      </Text>
    </TimelineOutlinedText>
  </View>
);

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
