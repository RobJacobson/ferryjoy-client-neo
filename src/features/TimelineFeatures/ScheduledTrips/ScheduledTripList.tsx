/**
 * ScheduledTripList - Presentational component for displaying scheduled trips.
 *
 * Receives pre-resolved page data (journeys, maps) and renders loading, empty,
 * or scrollable list of cards. No data fetching.
 */

import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { ScheduledTripCard } from "./ScheduledTripCard";
import type { ScheduledTripListPageData } from "./types";

type ScheduledTripListProps = ScheduledTripListPageData;

/**
 * Displays a scrollable list of scheduled trips from pre-resolved page data.
 *
 * @param status - "loading" | "empty" | "ready"
 * @param journeys - Journey data when ready
 * @param vesselTripByKeys - Map of segment Key to VesselTrip
 * @param vesselLocationByAbbrev - Map of vessel abbrev to location
 * @param currentTripByAbbrev - Map of current trip per vessel (active or held during arrival transition)
 * @returns Loading view, empty view, or scrollable list of ScheduledTripCard
 */
export const ScheduledTripList = ({
  status,
  journeys,
  vesselTripByKeys,
  vesselLocationByAbbrev,
  currentTripByAbbrev,
}: ScheduledTripListProps) => {
  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg">Loading schedule...</Text>
      </View>
    );
  }

  if (status === "empty") {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg text-muted-foreground">
          No scheduled trips found for this terminal today.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <Text variant="h2" className="mb-6 text-center">
          Daily Schedule
        </Text>
        {(journeys ?? [])
          .flatMap((trip) => {
            const vesselLocation = vesselLocationByAbbrev.get(
              trip.vesselAbbrev
            );
            const heldTrip = currentTripByAbbrev.get(trip.vesselAbbrev);
            return trip.segments.length > 0
              ? [{ trip, vesselLocation, vesselTripByKeys, heldTrip }]
              : [];
          })
          .map(({ trip, vesselLocation, vesselTripByKeys, heldTrip }) => (
            <ScheduledTripCard
              key={trip.id}
              trip={trip}
              vesselLocation={vesselLocation}
              vesselTripByKeys={vesselTripByKeys}
              heldTrip={heldTrip}
            />
          ))}
      </View>
    </ScrollView>
  );
};
