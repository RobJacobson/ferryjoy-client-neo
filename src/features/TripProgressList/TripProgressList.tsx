import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { TripProgressTimeProvider } from "@/data/contexts";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { TripProgressCard } from "@/features/TripProgressCard";

export type TripProgressListProps = {
  /** Space reserved for translucent header overlay; lets content scroll under it. */
  contentInsetTop?: number;
};

export const TripProgressList = ({
  contentInsetTop: _contentInsetTop = 0,
}: TripProgressListProps) => {
  const { activeVesselTrips, isLoading, error, delayedVesselTrips } =
    useConvexVesselTrips();

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
      </View>
    );
  }

  const displayTrips = delayedVesselTrips.filter((trip) => trip.InService);

  return (
    <TripProgressTimeProvider>
      <ScrollView className="flex-1 bg-background">
        <View className="gap-6 p-2">
          <Text variant="h2" className="mb-4 text-center">
            Active Vessel Trips
          </Text>
          {displayTrips.map((trip) => (
            <TripProgressCard
              key={`${trip.VesselAbbrev}-${trip.DepartingTerminalAbbrev}-${trip.TripStart?.getTime() ?? trip.TripEnd?.getTime() ?? Date.now()}`}
              trip={trip}
            />
          ))}
        </View>
      </ScrollView>
    </TripProgressTimeProvider>
  );
};
