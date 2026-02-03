/**
 * ScheduledTripList component for displaying a list of scheduled trips for a terminal.
 * Fetches data from Convex and handles loading/empty states.
 */

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import { ScheduledTripCard } from "./ScheduledTripCard";

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
 * @param terminalAbbrev - The terminal to show trips for
 * @param destinationAbbrev - Optional destination to filter by
 * @returns A scrollable list of ScheduledTripCard components
 */
export const ScheduledTripList = ({
  terminalAbbrev = "P52",
  destinationAbbrev,
}: ScheduledTripListProps) => {
  // Use current date for the sailing day in YYYY-MM-DD format
  const sailingDay = getSailingDay(new Date());

  // Fetch reconstructed trip chains from Convex
  const trips = useQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForTerminal,
    {
      terminalAbbrev,
      destinationAbbrev,
      sailingDay,
    }
  );

  // Loading state
  if (trips === undefined) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-lg">Loading schedule...</Text>
      </View>
    );
  }

  // Empty state
  if (trips.length === 0) {
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
        {trips.map((trip) => (
          <ScheduledTripCard key={trip.id} trip={trip} />
        ))}
      </View>
    </ScrollView>
  );
};
