import { ScrollView, View } from "react-native";
import { Text as UIText } from "@/components/ui";
import { TripTimelineCard } from "@/features/TripTimelineCard";

export default function SchedulesScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-6 gap-8"
    >
      <View>
        <UIText variant="h4" className="mb-3">
          TripTimeline (future)
        </UIText>
        <TripTimelineCard
          status="future"
          fromTerminal="SEA"
          toTerminal="BBI"
          startTime={startTime}
          departTime={departTime}
          endTime={endTime}
        />
      </View>

      <View>
        <UIText variant="h4" className="mb-3">
          TripTimeline (at-dock)
        </UIText>
        <TripTimelineCard
          status="atDock"
          fromTerminal="SEA"
          toTerminal="BBI"
          startTime={startTime}
          departTime={departTime}
          endTime={endTime}
        />
      </View>

      <View>
        <UIText variant="h4" className="mb-3">
          TripTimeline (at-sea, westward)
        </UIText>
        <TripTimelineCard
          status="atSea"
          fromTerminal="BBI"
          toTerminal="SEA"
          startTime={new Date(Date.now() - 60 * 60 * 1000)}
          departTime={new Date(Date.now() - 45 * 60 * 1000)}
          endTime={new Date(Date.now() + 15 * 60 * 1000)}
        />
      </View>

      <View>
        <UIText variant="h4" className="mb-3">
          TripTimeline (arrived)
        </UIText>
        <TripTimelineCard
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
