/**
 * Base timeline event component with time and icon.
 */

import { CalendarClock, EqualApproximately, Watch } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { Text, View } from "@/components/ui";
import { toDisplayTime } from "@/shared/utils/dateConversions";

const eventTypeIcon = {
  actual: Watch,
  scheduled: CalendarClock,
  estimated: EqualApproximately,
} as const;

type EventType = keyof typeof eventTypeIcon;

type TimelineEventProps = {
  time: Date;
  type: EventType;
};

const TimelineEvent = ({ time, type }: TimelineEventProps) => {
  const Icon = eventTypeIcon[type];
  return (
    <View className="flex-row gap-1">
      <Icon size={20} strokeWidth={1.5} color="#333" />
      <Text className="font-light">{toDisplayTime(time)}</Text>
    </View>
  );
};

const TimelineEventView = ({ children }: PropsWithChildren) => (
  <View className="mt-[-10px] bg-blue-200">{children}</View>
);

export { TimelineEvent, TimelineEventView };
