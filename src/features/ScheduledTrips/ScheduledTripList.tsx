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
    if (!trips) {
      return new Map<
        string,
        {
          vesselLocation?: VesselLocation;
          displayTrip?: VesselTrip;
          vesselTripMap?: Map<string, VesselTrip>;
          journeyStatus?: "Pending" | "InProgress" | "Completed";
        }
      >();
    }
    // Group journeys by vessel so only one journey per vessel can be active.
    const byVessel = new Map<string, typeof trips>();
    for (const t of trips) {
      const list = byVessel.get(t.vesselAbbrev) ?? [];
      list.push(t);
      byVessel.set(t.vesselAbbrev, list);
    }

    const resolutionById = new Map<
      string,
      {
        vesselLocation?: VesselLocation;
        displayTrip?: VesselTrip;
        vesselTripMap?: Map<string, VesselTrip>;
        journeyStatus?: "Pending" | "InProgress" | "Completed";
      }
    >();

    for (const [vesselAbbrev, vesselTrips] of byVessel) {
      const displayTripKey = displayTripByAbbrev.get(vesselAbbrev)?.Key ?? null;
      const vesselLocation = vesselLocationByAbbrev.get(vesselAbbrev);

      const activeKey =
        displayTripKey ??
        deriveActiveKeyFromVesselLocation({
          journeys: vesselTrips,
          vesselLocation,
          terminalAbbrev,
        });

      const activeJourneyIndex =
        activeKey != null
          ? vesselTrips.findIndex((j) =>
              j.segments.some((s) => s.Key === activeKey)
            )
          : -1;

      for (const [idx, journey] of vesselTrips.entries()) {
        const journeyStatus =
          activeJourneyIndex >= 0
            ? idx < activeJourneyIndex
              ? "Completed"
              : idx === activeJourneyIndex
                ? "InProgress"
                : "Pending"
            : undefined;

        resolutionById.set(journey.id, {
          vesselLocation: vesselLocationByAbbrev.get(vesselAbbrev),
          displayTrip: displayTripByAbbrev.get(vesselAbbrev),
          vesselTripMap,
          journeyStatus,
        });
      }
    }

    return resolutionById;
  }, [
    trips,
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
        {trips.map((trip) => (
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

/**
 * Best-effort derivation of an active scheduled segment Key from realtime VesselLocation.
 *
 * This exists to avoid shipping a precomputed key on every VesselLocation tick. Instead,
 * we use the authoritative realtime terminals and ScheduledDeparture to select the
 * closest matching scheduled segment Key from the page's journeys.
 *
 * @param params - Journeys for a single vessel and its current realtime location
 * @returns Matching scheduled segment Key or null when we cannot safely disambiguate
 */
const deriveActiveKeyFromVesselLocation = (params: {
  journeys: Array<{
    segments: Array<{
      Key: string;
      DepartingTime: number;
      DepartingTerminalAbbrev: string;
      ArrivingTerminalAbbrev: string;
    }>;
  }>;
  vesselLocation: VesselLocation | undefined;
  terminalAbbrev: string;
}): string | null => {
  const { journeys, vesselLocation, terminalAbbrev } = params;

  if (!vesselLocation) return null;

  // Only attempt to select an "active" journey on this page when the vessel's realtime
  // departing terminal matches the page's departing terminal.
  if (vesselLocation.DepartingTerminalAbbrev !== terminalAbbrev) return null;

  const scheduledDepartureMs = vesselLocation.ScheduledDeparture?.getTime();
  if (scheduledDepartureMs == null) return null;

  const arrivingAbbrev = vesselLocation.ArrivingTerminalAbbrev;

  const candidates: string[] = [];
  for (const journey of journeys) {
    for (const segment of journey.segments) {
      if (segment.DepartingTerminalAbbrev !== terminalAbbrev) continue;
      if (!vesselLocation.AtDock) {
        if (!arrivingAbbrev) continue;
        if (segment.ArrivingTerminalAbbrev !== arrivingAbbrev) continue;
      }

      if (segment.DepartingTime === scheduledDepartureMs) {
        candidates.push(segment.Key);
      }
    }
  }

  return candidates[0] ?? null;
};
