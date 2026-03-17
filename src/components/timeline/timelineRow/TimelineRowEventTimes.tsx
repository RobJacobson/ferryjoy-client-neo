/**
 * Right-column event times with icons for timeline rows.
 */

import { CalendarClock, EqualApproximately, Timer } from "lucide-react-native";
import { Text, View } from "@/components/ui";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import { TIMELINE_SIDE_COLUMN_OFFSET_PX } from "../config";
import type { TimelineTimePoint } from "../types";

const eventTypeIcons = {
  actual: Timer,
  scheduled: CalendarClock,
  estimated: EqualApproximately,
} as const;

type EventType = keyof typeof eventTypeIcons;

type TimelineRowEventTimesProps = {
  point: TimelineTimePoint;
};

/**
 * Renders scheduled, actual, and estimated times for a timeline boundary.
 *
 * @param point - The time point containing scheduled, actual, and estimated dates
 * @returns The event times view
 */
export const TimelineRowEventTimes = ({
  point,
}: TimelineRowEventTimesProps) => {
  const { scheduled, actual, estimated } = point;
  const secondary = actual ?? estimated;

  return (
    <View
      className="mx-2 mt-[-10px] flex-1 flex-row gap-1"
      style={{ paddingLeft: TIMELINE_SIDE_COLUMN_OFFSET_PX }}
    >
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

  return (
    <View className="relative flex-row gap-1">
      <View className="absolute top-[1px] left-[-1px] flex-row gap-1">
        <View className="my-[-1px]">
          <Icon size={22} strokeWidth={1.5} color="white" />
        </View>
        <Text className="font-led-board text-white">{displayTime}</Text>
      </View>
      <View className="flex-row gap-1">
        <View className="my-[-1px]">
          <Icon size={22} strokeWidth={1.5} color="hsl(273 81% 47%)" />
        </View>
        <Text className="font-led-board text-purple-700">{displayTime}</Text>
      </View>
    </View>
  );
};
