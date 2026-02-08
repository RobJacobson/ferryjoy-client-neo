import { View } from "react-native";
import { Text } from "@/components/ui";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { VesselTimeline } from "@/features/TimelineFeatures/VesselTimeline";

/**
 * ChatScreen serves as a placeholder to demonstrate the new VesselTripTimelineVertical.
 * It picks the first available vessel with location data and displays its daily timeline.
 */
export default function ChatScreen() {
  const { vesselLocations, isLoading } = useConvexVesselLocations();

  // Pick a vessel to demo (e.g., the first one in the list)
  const demoVessel = vesselLocations?.[0];

  return (
    <View className="flex-1 bg-background">
      <View className="px-6 pt-12 pb-4 border-b border-border bg-card">
        <Text className="text-2xl font-playwrite-bold text-primary">
          Vessel Daily Log
        </Text>
        <Text className="text-sm text-muted-foreground">
          {demoVessel
            ? `Viewing ${demoVessel.VesselName} (${demoVessel.VesselAbbrev})`
            : "Loading vessel data..."}
        </Text>
      </View>

      {demoVessel ? (
        <VesselTimeline
          vesselAbbrev={demoVessel.VesselAbbrev}
          vesselLocation={demoVessel}
          className="flex-1"
        />
      ) : (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-muted-foreground text-center">
            {isLoading
              ? "Connecting to Convex..."
              : "No active vessel locations found to display a timeline."}
          </Text>
        </View>
      )}
    </View>
  );
}
