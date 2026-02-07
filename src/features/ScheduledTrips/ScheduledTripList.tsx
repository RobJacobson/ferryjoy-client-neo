/**
 * ScheduledTripList component for displaying a list of scheduled trips for a terminal.
 * Fetches data from Convex and handles loading/empty states.
 */

import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { ScheduledTripCard } from "./ScheduledTripCard";
import { useScheduledTripsPageData } from "./useScheduledTripsPageData";

type ScheduledTripListProps = {
  /**
   * Departure terminal abbreviation (defaults to Seattle/P52).
   */
  terminalAbbrev?: string;
  /**
   * Optional destination terminal abbreviation to filter trips.
   */
  destinationAbbrev?: string;
};

/**
 * Displays a scrollable list of scheduled trips for a specific terminal and optional destination.
 * Automatically uses the current sailing day for data fetching.
 *
 * Renders loading state, empty state (no trips today), or a scrollable list of cards. When ready,
 * each card receives pre-resolved page data when available so the timeline does not refetch per card.
 *
 * @param terminalAbbrev - The terminal to show trips for
 * @param destinationAbbrev - Optional destination to filter by
 * @returns A scrollable list of ScheduledTripCard components
 */
export const ScheduledTripList = ({
  terminalAbbrev = "P52",
  destinationAbbrev,
}: ScheduledTripListProps) => {
  const {
    status,
    journeys,
    segmentTuplesByJourneyId,
    displayStateByJourneyId,
    vesselLocationByAbbrev,
  } = useScheduledTripsPageData({ terminalAbbrev, destinationAbbrev });

  if (status === "loading") {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-lg">Loading schedule...</Text>
      </View>
    );
  }

  if (status === "empty") {
    return (
      <View className="flex-1 justify-center items-center p-4">
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
            const segmentTuples = segmentTuplesByJourneyId.get(trip.id);
            const displayState = displayStateByJourneyId.get(trip.id);
            const vesselLocation =
              vesselLocationByAbbrev.get(trip.vesselAbbrev) ?? null;
            return segmentTuples != null &&
              segmentTuples.length > 0 &&
              displayState != null
              ? [{ trip, segmentTuples, displayState, vesselLocation }]
              : [];
          })
          .map(({ trip, segmentTuples, displayState, vesselLocation }) => (
            <ScheduledTripCard
              key={trip.id}
              trip={trip}
              segmentTuples={segmentTuples}
              displayState={displayState}
              vesselLocation={vesselLocation}
            />
          ))}
      </View>
    </ScrollView>
  );
};
