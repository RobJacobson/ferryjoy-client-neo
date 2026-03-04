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

const TimelineEvent = ({ time, type }: TimelineEventProps) => {
  const Icon = eventTypeIcon[type];
  return (
    <View className="flex-row items-center gap-1">
      <Icon size={16} strokeWidth={1.5} color="#333" />
      <Text className="font-bold text-sm">{toDisplayTime(time)}</Text>
    </View>
  );
};

export default TimelineEvent;
