/**
 * Container screen for VesselTripTimeline feature with live data.
 */

import { Text, View } from "@/components/ui";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { useDelayedVesselTrips } from "@/features/TimelineFeatures/shared";
import { VesselTripTimelineList } from "./VesselTripTimelineList";

/**
 * Fetches live vessel trip/location data and renders timeline cards.
 *
 * @returns Vessel trip timeline screen with loading, error, and empty states
 */
export const VesselTripTimelineScreen = () => {
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

  // Filter to in-service trips only and aggregate loading/error states
  const inServiceItems = displayData.filter(({ trip }) => trip.InService);
  const isLoading = tripsLoading || locationsLoading;
  const error = tripsError || locationsError;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-semibold text-lg">Loading vessel trips...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-semibold text-destructive text-lg">
          Unable to load vessel trips
        </Text>
        <Text className="mt-2 text-center text-muted-foreground text-sm">
          {error}
        </Text>
      </View>
    );
  }

  if (inServiceItems.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-semibold text-lg">No active vessel trips</Text>
        <Text className="mt-2 text-center text-muted-foreground text-sm">
          Check back shortly for in-service vessels.
        </Text>
      </View>
    );
  }

  return <VesselTripTimelineList items={inServiceItems} />;
};
