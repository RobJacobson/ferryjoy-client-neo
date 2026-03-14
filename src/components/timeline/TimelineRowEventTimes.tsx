/**
 * Right-column event times with icons for timeline rows.
 */

import { CalendarClock, EqualApproximately, Timer } from "lucide-react-native";
import { Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toDisplayTime } from "@/shared/utils/dateConversions";
import type { TimelineTimePoint } from "./types";

const eventTypeIcon = {
  actual: Timer,
  scheduled: CalendarClock,
  estimated: EqualApproximately,
} as const;

type EventType = keyof typeof eventTypeIcon;

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
    <View className="mt-[-10px] flex-1 justify-start">
      <View className="flex-row gap-1">
        {scheduled && <EventTime time={scheduled} type="scheduled" />}
        {secondary && (
          <EventTime time={secondary} type={actual ? "actual" : "estimated"} />
        )}
      </View>
    </View>
  );
};

type EventTimeProps = {
  time: Date;
  type: EventType;
};

const EventTime = ({ time, type }: EventTimeProps) => {
  const Icon = eventTypeIcon[type];
  return (
    <View className={cn("flex-row", type === "scheduled" ? "gap-1" : "gap-0")}>
      <View className="my-[-1px]">
        <Icon size={22} strokeWidth={1.5} color="#a855f7" />
      </View>
      <Text className="font-bitcount-400 text-purple-800">
        {toDisplayTime(time)}
      </Text>
    </View>
  );
};
