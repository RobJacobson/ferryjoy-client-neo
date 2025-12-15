import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { TripTimelineCard } from "@/features/TripTimelineCard";

export default function SchedulesScreen() {
  const startTime = new Date(Date.now() - 10 * 60 * 1000);
  const departTime = new Date(Date.now() + 5 * 60 * 1000);
  const endTime = new Date(Date.now() + 55 * 60 * 1000);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-6 gap-8"
    >
      <View>
        <Text variant="heading4" className="mb-3">
          TripTimeline (future)
        </Text>
        <TripTimelineCard
          direction="eastward"
          status="future"
          fromTerminal="SEA"
          toTerminal="BBI"
          startTime={startTime}
          departTime={departTime}
          endTime={endTime}
        />
      </View>

      <View>
        <Text variant="heading4" className="mb-3">
          TripTimeline (at-dock)
        </Text>
        <TripTimelineCard
          direction="eastward"
          status="atDock"
          fromTerminal="SEA"
          toTerminal="BBI"
          startTime={startTime}
          departTime={departTime}
          endTime={endTime}
        />
      </View>

      <View>
        <Text variant="heading4" className="mb-3">
          TripTimeline (at-sea, westward)
        </Text>
        <TripTimelineCard
          direction="westward"
          status="atSea"
          fromTerminal="BBI"
          toTerminal="SEA"
          startTime={new Date(Date.now() - 60 * 60 * 1000)}
          departTime={new Date(Date.now() - 45 * 60 * 1000)}
          endTime={new Date(Date.now() + 15 * 60 * 1000)}
        />
      </View>

      <View>
        <Text variant="heading4" className="mb-3">
          TripTimeline (arrived)
        </Text>
        <TripTimelineCard
          direction="westward"
          status="arrived"
          fromTerminal="SEA"
          toTerminal="BBI"
          startTime={new Date(Date.now() - 80 * 60 * 1000)}
          departTime={new Date(Date.now() - 65 * 60 * 1000)}
          endTime={new Date(Date.now() - 10 * 60 * 1000)}
        />
      </View>
    </ScrollView>
  );
}
