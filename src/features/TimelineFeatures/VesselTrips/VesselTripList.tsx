import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { useDelayedVesselTrips } from "./useDelayedVesselTrips";
import { VesselTripCard } from "./VesselTripCard";

export type TripProgressListProps = {
  /** Space reserved for translucent header overlay; lets content scroll under it. */
  contentInsetTop?: number;
};

/**
 * VesselTripList displays active vessel trips with a hold window for stability.
 *
 * When a vessel's active trip disappears (e.g., it completes), this component
 * continues showing the recently started trip for 30 seconds before removing it.
 * This prevents UI flicker and provides a smooth transition for users.
 *
 * The hold window logic is implemented in useDelayedVesselTrips hook,
 * which uses the trip's own TripStart timestamp to determine if it's
 * within the hold window.
 */
export const TripProgressList = ({
  contentInsetTop: _contentInsetTop = 0,
}: TripProgressListProps) => {
  const {
    activeVesselTrips,
    isLoading: tripsLoading,
    error: tripsError,
  } = useConvexVesselTrips();
  const {
    vesselLocations,
    isLoading: locationsLoading,
    error: locationsError,
  } = useConvexVesselLocations();

  const { displayData } = useDelayedVesselTrips(
    activeVesselTrips,
    vesselLocations
  );

  if (tripsLoading || locationsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-xl">Loading active vessel trips...</Text>
      </View>
    );
  }

  if (tripsError || locationsError) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-red-500 text-xl">
          Error: {tripsError || locationsError}
        </Text>
      </View>
    );
  }

  if (!displayData || displayData.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="mb-4 font-bold text-xl">Active Vessel Trips</Text>
      </View>
    );
  }

  // Filter for in-service trips
  const inServiceTrips = displayData.filter(({ trip }) => trip.InService);

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="gap-6 p-2">
        <Text variant="h2" className="mb-4 text-center">
          Active Vessel Trips
        </Text>
        {inServiceTrips.map(({ trip, vesselLocation }) => (
          <VesselTripCard
            key={`${trip.VesselAbbrev}-${trip.TripStart?.getTime() ?? "no-start"}`}
            trip={trip}
            vesselLocation={vesselLocation}
          />
        ))}
      </View>
    </ScrollView>
  );
};
