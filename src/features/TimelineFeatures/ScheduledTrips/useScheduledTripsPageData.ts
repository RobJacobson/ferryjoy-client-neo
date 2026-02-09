/**
 * Hook that fetches and resolves all data needed to render the ScheduledTrips list.
 * Schedule is primary; overlay (completed/active) is optional and does not block "ready".
 * Runs pipeline: join schedule + overlay by Key → segment tuples + page display state.
 */

import { api } from "convex/_generated/api";
import { toDomainScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import type { ScheduledTripJourney } from "./types";
import { useScheduledTripsMaps } from "./useScheduledTripsMaps";
import { reconstructJourneys } from "./utils/reconstructJourneys";

type UseScheduledTripsPageDataParams = {
  terminalAbbrev: string;
  destinationAbbrev?: string;
};

type UseScheduledTripsPageDataResult = {
  status: "loading" | "empty" | "ready";
  journeys: ScheduledTripJourney[] | undefined;
  /**
   * Map of segment Key to VesselTrip for O(1) lookup. Used with PrevKey/NextKey for prev/next trips.
   */
  vesselTripMap: Map<string, VesselTrip>;
  /**
   * Vessel location map used during render for real-time status/phase and bar animations.
   * Empty when overlay data is missing or still loading.
   */
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  /**
   * Held trip map used to preserve UX identity during arrival transitions.
   */
  displayTripByAbbrev: Map<string, VesselTrip>;
};

/**
 * Fetches schedule first (primary), then overlay (completed/active). Ready when schedule is loaded;
 * overlay is optional (basic schedule when missing).
 *
 * @param terminalAbbrev - Departure terminal to load schedule for (e.g. "P52")
 * @param destinationAbbrev - Optional destination terminal to filter trips
 * @returns Object with status ("loading" | "empty" | "ready"), journeys, vesselTripMap, etc.
 */
export const useScheduledTripsPageData = ({
  terminalAbbrev,
  destinationAbbrev,
}: UseScheduledTripsPageDataParams): UseScheduledTripsPageDataResult => {
  const sailingDay = getSailingDay(new Date());

  const rawSchedule = useQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForTerminal,
    { terminalAbbrev, destinationAbbrev, sailingDay }
  );

  // Map to domain only when query has resolved; avoid treating loading as empty.
  const flatDomain = rawSchedule?.map(toDomainScheduledTrip) ?? [];

  // Client-side journey reconstruction (grouping and chain building).
  const journeys = reconstructJourneys(
    flatDomain,
    terminalAbbrev,
    destinationAbbrev
  );

  // Unique departing terminal abbrevs from flat segments (for completed-trip lookups).
  const departingTerminalAbbrevs = [
    ...new Set(flatDomain.map((s) => s.DepartingTerminalAbbrev)),
  ];

  const maps = useScheduledTripsMaps({ sailingDay, departingTerminalAbbrevs });

  // Treat undefined query result as loading; only then distinguish empty vs ready.
  const status: UseScheduledTripsPageDataResult["status"] =
    rawSchedule === undefined
      ? "loading"
      : journeys.length === 0
        ? "empty"
        : "ready";

  return {
    status,
    journeys,
    vesselTripMap: maps?.vesselTripMap ?? new Map<string, VesselTrip>(),
    vesselLocationByAbbrev:
      maps?.vesselLocationByAbbrev ?? new Map<string, VesselLocation>(),
    displayTripByAbbrev:
      maps?.displayTripByAbbrev ?? new Map<string, VesselTrip>(),
  };
};
