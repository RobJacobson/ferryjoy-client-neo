/**
 * Right-column event times with icons for timeline rows.
 */

import { CalendarClock, EqualApproximately, Timer } from "lucide-react-native";
import { Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import { TIMELINE_SIDE_COLUMN_OFFSET_PX } from "../config";
import type { TimelineTimePoint } from "../types";

const eventTypeIcons = {
  actual: Timer,
  scheduled: CalendarClock,
  estimated: EqualApproximately,
} as const;

const EVENT_TIME_ICON_COLOR = "hsl(273 81% 47%)";

type EventType = keyof typeof eventTypeIcons;

type TimelineRowEventTimesProps = {
  point: TimelineTimePoint;
  showPlaceholder?: boolean;
};

/**
 * Renders scheduled, actual, and estimated times for a timeline boundary.
 *
 * @param point - The time point containing scheduled, actual, and estimated dates
 * @returns The event times view
 */
export const TimelineRowEventTimes = ({
  point,
  showPlaceholder = false,
}: TimelineRowEventTimesProps) => {
  const { scheduled, actual, estimated } = point;
  const secondary = actual ?? estimated;
  const hasVisibleTimes =
    scheduled !== undefined || actual !== undefined || estimated !== undefined;

  return (
    <View
      className="mt-[-14px] flex-1 flex-row gap-1"
      style={{ paddingLeft: TIMELINE_SIDE_COLUMN_OFFSET_PX }}
    >
      {!hasVisibleTimes && showPlaceholder && <MissingEventTime />}
      {scheduled && <EventTime time={scheduled} type="scheduled" />}
      {secondary && (
        <EventTime time={secondary} type={actual ? "actual" : "estimated"} />
      )}
    </View>
  );
};

type EventTimeProps = {
  time: Date;
  type: EventType;
};

const EventTime = ({ time, type }: EventTimeProps) => {
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
          <Icon size={22} strokeWidth={1.5} color="white" />
        </View>
        <Text className="font-led-phatt text-lg text-white">{displayTime}</Text>
      </View>
      {/* Regular text */}
      <View className={cn("flex-row", iconGapPx)}>
        <View className="mt-[1px]">
          <Icon size={24} strokeWidth={1.5} color={EVENT_TIME_ICON_COLOR} />
        </View>
        <Text className="font-led-phatt text-lg text-purple-700">
          {displayTime}
        </Text>
      </View>
    </View>
  );
};

const MissingEventTime = () => (
  <View className="relative flex-row">
    <View className="absolute top-[1px] left-[-1px] flex-row gap-1">
      <View className="mt-[1px]">
        <CalendarClock size={22} strokeWidth={1.5} color="white" />
      </View>
      <Text className="font-led-phatt text-lg text-white">--</Text>
    </View>
    <View className="flex-row gap-1">
      <View className="mt-[1px]">
        <CalendarClock
          size={24}
          strokeWidth={1.5}
          color={EVENT_TIME_ICON_COLOR}
        />
      </View>
      <Text className="font-led-phatt text-lg text-purple-700">--</Text>
    </View>
  </View>
);
