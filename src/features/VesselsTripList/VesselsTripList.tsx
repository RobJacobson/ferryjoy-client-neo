import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import {
  useConvexVesselTrips,
  type VesselTrip,
} from "@/data/contexts/convex/ConvexVesselTripsContext";
import { TripTimelineCard } from "@/features/TripTimelineCard";

const getTimelineProps = (trip: VesselTrip) => {
  return {
    status: trip.AtDock ? ("atDock" as const) : ("atSea" as const),
    fromTerminal: trip.DepartingTerminalAbbrev || "",
    toTerminal: trip.ArrivingTerminalAbbrev || "",
    startTime: trip.TripStart || new Date(),
    departTime:
      trip.LeftDock ||
      new Date((trip.TripStart?.getTime() || 0) + 10 * 60 * 1000),
    endTime:
      trip.Eta || new Date((trip.TripStart?.getTime() || 0) + 30 * 60 * 1000),
  };
};

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
          .filter(
            (trip) =>
              trip.InService &&
              trip.DepartingTerminalID &&
              trip.ArrivingTerminalID
          )
          .map((trip) => (
            <View key={trip.VesselID} className="mb-4">
              <View className="flex-row">
                <Text className="text-lg font-bold">
                  {trip.DepartingTerminalName}
                </Text>
                <Text className="text-lg font-light">
                  {` → ${trip.ArrivingTerminalName}`}
                </Text>
              </View>
              <TripTimelineCard
                {...getTimelineProps(trip)}
                VesselName={trip.VesselName || "Unknown Vessel"}
                VesselStatus={getVesselStatus(trip)}
              />
            </View>
          ))}
      </View>
    </ScrollView>
  );
};

const getVesselStatus = (trip: VesselTrip): string => {
  if (trip.AtDock) {
    return "At Dock";
  }
  if (!trip.Speed) {
    return "At Sea";
  }
  return `${trip.Speed?.toFixed(1)} knots`;
};
