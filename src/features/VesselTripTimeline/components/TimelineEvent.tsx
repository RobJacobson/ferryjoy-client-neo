/**
 * Base timeline event component with time and icon.
 */

import { CalendarClock, EqualApproximately, Watch } from "lucide-react-native";
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

/**
 * Renders a timeline event with time and icon.
 *
 * @param time - Event time to display
 * @param type - Event type determining icon (actual, scheduled, estimated)
 * @returns Timeline event component
 */
export const TimelineEvent = ({ time, type }: TimelineEventProps) => {
  const Icon = eventTypeIcon[type];
  return (
    <View className="flex-row gap-1">
      <Icon size={20} strokeWidth={1.5} color="#555" />
      <Text className="font-playpen-400 text-sm">{toDisplayTime(time)}</Text>
    </View>
  );
};
