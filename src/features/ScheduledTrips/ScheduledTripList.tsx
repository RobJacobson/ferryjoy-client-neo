/**
 * ScheduledTripList component for displaying a list of scheduled trips for a terminal.
 * Fetches data from Convex and handles loading/empty states.
 */

import { api } from "convex/_generated/api";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import { createVesselTripMap } from "../Timeline/utils";
import { useDelayedVesselTrips } from "../VesselTrips/useDelayedVesselTrips";
import type { ScheduledTripCardResolution } from "./resolveScheduledTripsPageResolution";
import { resolveScheduledTripsPageResolution } from "./resolveScheduledTripsPageResolution";
import { ScheduledTripCard } from "./ScheduledTripCard";
import { toSegment } from "./utils/conversion";

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

  const { activeVesselTrips } = useConvexVesselTrips();
  const { vesselLocations } = useConvexVesselLocations();
  const { displayData } = useDelayedVesselTrips(
    activeVesselTrips,
    vesselLocations
  );

  // Fetch reconstructed trip chains from Convex
  const trips = useQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForTerminal,
    {
      terminalAbbrev,
      destinationAbbrev,
      sailingDay,
    }
  );

  const journeys = useMemo(() => {
    if (!trips) return undefined;

    return trips.map((trip) => ({
      ...trip,
      segments: trip.segments.map(toSegment),
    }));
  }, [trips]);

  const departingTerminalAbbrevs = useMemo(() => {
    if (!trips) return [];
    const set = new Set<string>();
    for (const t of trips) {
      for (const s of t.segments) {
        set.add(s.DepartingTerminalAbbrev);
      }
    }
    return Array.from(set);
  }, [trips]);

  const rawCompletedTrips = useQuery(
    api.functions.vesselTrips.queries
      .getCompletedTripsForSailingDayAndTerminals,
    departingTerminalAbbrevs.length > 0
      ? { sailingDay, departingTerminalAbbrevs }
      : "skip"
  );
  const completedTrips = useMemo(
    () => rawCompletedTrips?.map(toDomainVesselTrip) ?? [],
    [rawCompletedTrips]
  );

  const vesselTripMap = useMemo(() => {
    const map = createVesselTripMap(completedTrips);
    for (const trip of activeVesselTrips) {
      if (trip.Key) map.set(trip.Key, trip);
    }
    for (const d of displayData) {
      if (d.trip.Key) map.set(d.trip.Key, d.trip);
    }
    return map;
  }, [completedTrips, activeVesselTrips, displayData]);

  const vesselLocationByAbbrev = useMemo(() => {
    const live = new Map<string, VesselLocation>();
    for (const loc of vesselLocations) live.set(loc.VesselAbbrev, loc);
    const synced = new Map<string, VesselLocation>();
    for (const d of displayData) {
      synced.set(d.trip.VesselAbbrev, d.vesselLocation);
    }
    return new Map(
      Array.from(live.entries()).map(([abbrev, loc]) => [
        abbrev,
        synced.get(abbrev) ?? loc,
      ])
    );
  }, [vesselLocations, displayData]);

  const displayTripByAbbrev = useMemo(() => {
    const map = new Map<string, VesselTrip>();
    for (const d of displayData) {
      map.set(d.trip.VesselAbbrev, d.trip);
    }
    return map;
  }, [displayData]);

  const pageResolutionByTripId = useMemo(() => {
    if (!journeys) {
      return new Map<string, ScheduledTripCardResolution>();
    }

    return resolveScheduledTripsPageResolution({
      terminalAbbrev,
      journeys,
      vesselLocationByAbbrev,
      displayTripByAbbrev,
      vesselTripMap,
    });
  }, [
    journeys,
    displayTripByAbbrev,
    vesselLocationByAbbrev,
    vesselTripMap,
    terminalAbbrev,
  ]);

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
        {(journeys ?? []).map((trip) => (
          <ScheduledTripCard
            key={trip.id}
            trip={trip}
            resolution={pageResolutionByTripId.get(trip.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
};
