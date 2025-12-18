import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NotchGlassOverlay } from "@/components/NotchGlassOverlay";
import { Text, View } from "@/components/ui";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { VesselTripCard } from "@/features/VesselTripCard";

export const VesselsTripList = () => {
  const { activeVesselTrips, isLoading, error } = useConvexVesselTrips();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-xl">Loading active vessel trips...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-xl text-red-500">Error: {error}</Text>
      </View>
    );
  }

  if (!activeVesselTrips || activeVesselTrips.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="mb-4 text-xl font-bold">Active Vessel Trips</Text>
        <Text className="text-gray-600">
          No active vessel trip data available
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ flex: 1, backgroundColor: "transparent" }}
    >
      <ScrollView
        style={{ flex: 1 }}
        // Content extends into notch area - starts at top: 0
        // The progressive blur overlay will blur content as it approaches the notch
        contentContainerStyle={{
          paddingBottom: insets.bottom,
          paddingTop: 0, // No top padding - content starts at very top
        }}
        // Use never so content can extend into notch area
        contentInsetAdjustmentBehavior="never"
        // Allow content to scroll under the notch
        automaticallyAdjustContentInsets={false}
        // Remove any default content insets
        contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        scrollIndicatorInsets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      >
        {/* Content container - background extends to top: 0, into notch area */}
        {/* Text has padding but background extends above it */}
        <View
          className="gap-6 p-6 bg-background"
          style={{
            // Negative top margin to extend background into notch
            marginTop: -insets.top,
            // Padding for content, but background extends above
            paddingTop: insets.top + 24,
            minHeight: "100%",
          }}
        >
          <Text variant="heading2" className="mb-4 text-center">
            Active Vessel Trips
          </Text>
          {activeVesselTrips
            .filter((trip) => trip.InService)
            .map((trip) => (
              <VesselTripCard key={trip.VesselID} trip={trip} />
            ))}
        </View>
      </ScrollView>

      {/* Glass/blur overlay for notch area - blurs content behind it */}
      <NotchGlassOverlay position="top" />
    </View>
  );
};
