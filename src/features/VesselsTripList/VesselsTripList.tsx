import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { VesselTripCard } from "@/features/VesselTripCard";

export const VesselsTripList = () => {
  const { activeVesselTrips, isLoading, error } = useConvexVesselTrips();

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
    <ScrollView className="flex-1 bg-background">
      <View className="gap-6 p-6">
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
  );
};
