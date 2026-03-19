/**
 * Right-column event times with icons for timeline rows.
 */

import { CalendarClock, EqualApproximately, Timer } from "lucide-react-native";
import { Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import { TIMELINE_SIDE_COLUMN_OFFSET_PX } from "../config";
import {
  DEFAULT_TIMELINE_VISUAL_THEME,
  type TimelineVisualTheme,
} from "../theme";
import type { TimelineTimePoint } from "../types";

const eventTypeIcons = {
  actual: Timer,
  scheduled: CalendarClock,
  estimated: EqualApproximately,
} as const;

type EventType = keyof typeof eventTypeIcons;

type TimelineRowEventTimesProps = {
  point: TimelineTimePoint;
  showPlaceholder?: boolean;
  theme?: TimelineVisualTheme;
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
  theme = DEFAULT_TIMELINE_VISUAL_THEME,
}: TimelineRowEventTimesProps) => {
  const { scheduled, actual, estimated } = point;
  const secondary = actual ?? estimated;
  const hasVisibleTimes =
    scheduled !== undefined || actual !== undefined || estimated !== undefined;

  return (
    <View
      className="mt-[-14px] flex-1 flex-row gap-1"
      style={{ marginLeft: TIMELINE_SIDE_COLUMN_OFFSET_PX }}
    >
      {!hasVisibleTimes && showPlaceholder && (
        <MissingEventTime theme={theme} />
      )}
      {scheduled && (
        <EventTime time={scheduled} type="scheduled" theme={theme} />
      )}
      {secondary && (
        <EventTime
          time={secondary}
          type={actual ? "actual" : "estimated"}
          theme={theme}
        />
      )}
    </View>
  );
};

type EventTimeProps = {
  time: Date;
  type: EventType;
  theme: TimelineVisualTheme;
};

const EventTime = ({ time, type, theme }: EventTimeProps) => {
  const Icon = eventTypeIcons[type];
  const displayTime = toDisplayTime(time);

  const iconGapPx = type === "scheduled" ? "gap-1" : "";

  return (
    <View className="relative flex-row">
      {/* Shadow text */}
      <View
        className={cn("absolute top-[1px] left-[-1px] flex-row", iconGapPx)}
      >
        <View className="mt-[1px]">
          <Icon
            size={22}
            strokeWidth={1.5}
            color={theme.times.shadowIconColor}
          />
        </View>
        <Text
          className={theme.times.fontClassName}
          style={[{ color: theme.times.shadowColor }, theme.times.textStyle]}
        >
          {displayTime}
        </Text>
      </View>
      {/* Regular text */}
      <View className={cn("flex-row", iconGapPx)}>
        <View className="mt-[1px]">
          <Icon size={24} strokeWidth={1.5} color={theme.times.iconColor} />
        </View>
        <Text
          className={theme.times.fontClassName}
          style={[{ color: theme.times.textColor }, theme.times.textStyle]}
        >
          {displayTime}
        </Text>
      </View>
    </View>
  );
};

const MissingEventTime = ({ theme }: { theme: TimelineVisualTheme }) => (
  <View className="relative flex-row">
    <View className="absolute top-[1px] left-[-1px] flex-row gap-1">
      <View className="mt-[1px]">
        <CalendarClock
          size={22}
          strokeWidth={1.5}
          color={theme.times.shadowIconColor}
        />
      </View>
      <Text
        className={theme.times.fontClassName}
        style={[{ color: theme.times.shadowColor }, theme.times.textStyle]}
      >
        --
      </Text>
    </View>
    <View className="flex-row gap-1">
      <View className="mt-[1px]">
        <CalendarClock
          size={24}
          strokeWidth={1.5}
          color={theme.times.iconColor}
        />
      </View>
      <Text
        className={theme.times.fontClassName}
        style={[{ color: theme.times.textColor }, theme.times.textStyle]}
      >
        --
      </Text>
    </View>
  </View>
);
